const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Ensure local fallback uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'scans');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let supabaseClient = null;
const bucketName = 'scan-images';

function getSupabaseClient() {
  let supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
  if (supabaseUrl.endsWith('/rest/v1/')) supabaseUrl = supabaseUrl.slice(0, -9);
  else if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.slice(0, -8);
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ? process.env.SUPABASE_SECRET_KEY.trim() : '';

  if (supabaseUrl && supabaseSecretKey && !supabaseClient) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
        auth: { persistSession: false }
      });
      console.log('[Storage] Supabase Storage client initialized for bucket:', bucketName);
    } catch (err) {
      console.warn('[Storage Warning] Failed to initialize Supabase client:', err.message);
    }
  }
  return supabaseClient;
}

/**
 * Check health status of storage integration
 */
async function getStorageStatus() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return {
      provider: 'local_disk',
      status: 'active',
      bucket: bucketName,
      message: 'Local disk fallback active. Set SUPABASE_URL and SUPABASE_SECRET_KEY for cloud storage.'
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      provider: 'supabase',
      status: 'error',
      bucket: bucketName,
      message: 'Supabase client configuration invalid.'
    };
  }

  try {
    // Test listing buckets or bucket existence
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) {
      return {
        provider: 'supabase',
        status: 'error',
        bucket: bucketName,
        message: `Supabase Storage error: ${error.message}`
      };
    }

    const hasBucket = buckets && buckets.some(b => b.name === bucketName);
    return {
      provider: 'supabase',
      status: 'connected',
      bucket: bucketName,
      bucketExists: hasBucket,
      message: hasBucket ? `Connected to Supabase bucket '${bucketName}'.` : `Connected to Supabase. Bucket '${bucketName}' will be created on first upload.`
    };
  } catch (err) {
    return {
      provider: 'supabase',
      status: 'error',
      bucket: bucketName,
      message: err.message
    };
  }
}

/**
 * Upload a scan image (base64 data URL or buffer) to storage
 * Returns accessible image URL or relative path
 */
async function uploadScanImage(imageData, scanType = 'pre-shift') {
  if (!imageData) return '/uploads/scans/sample_preshift_1.jpg';

  // If already an HTTP/HTTPS URL, return directly
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }

  // If already a relative upload path, return directly
  if (imageData.startsWith('/uploads/')) {
    return imageData;
  }

  // Parse Base64 Image
  let buffer;
  let ext = 'jpg';
  let contentType = 'image/jpeg';

  if (imageData.startsWith('data:image/')) {
    const matches = imageData.match(/^data:(image\/(\w+));base64,(.+)$/);
    if (matches) {
      contentType = matches[1];
      ext = matches[2] === 'png' ? 'png' : 'jpg';
      buffer = Buffer.from(matches[3], 'base64');
    } else {
      const parts = imageData.split(',');
      buffer = Buffer.from(parts[1] || parts[0], 'base64');
    }
  } else {
    buffer = Buffer.from(imageData, 'base64');
  }

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const cleanScanType = scanType.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${cleanScanType}_${timestamp}_${randomStr}.${ext}`;

  const client = getSupabaseClient();
  if (client) {
    try {
      // Ensure bucket exists if user has storage admin permission
      try {
        await client.storage.createBucket(bucketName, { public: true });
      } catch (e) {
        // Bucket may already exist
      }

      const filePath = `scans/${fileName}`;
      const { data, error } = await client.storage
        .from(bucketName)
        .upload(filePath, buffer, {
          contentType,
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = client.storage.from(bucketName).getPublicUrl(filePath);
        if (publicUrlData && publicUrlData.publicUrl) {
          console.log(`[Storage] Uploaded image to Supabase Storage: ${publicUrlData.publicUrl}`);
          return publicUrlData.publicUrl;
        }
      } else {
        console.warn('[Storage Warning] Supabase upload failed, using local disk fallback:', error ? error.message : 'Unknown error');
      }
    } catch (err) {
      console.warn('[Storage Exception] Falling back to local disk:', err.message);
    }
  }

  // Local Disk Fallback
  const localFilePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(localFilePath, buffer);
  const relativeUrl = `/uploads/scans/${fileName}`;
  console.log(`[Storage] Saved image to local disk fallback: ${relativeUrl}`);
  return relativeUrl;
}

module.exports = {
  uploadScanImage,
  getStorageStatus,
  getSupabaseClient
};
