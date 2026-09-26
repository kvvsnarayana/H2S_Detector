const ExcelJS = require('exceljs');

/**
 * Generate multi-sheet Excel report workbook buffer from SQLite database
 * Worksheets: Workers, Badges, Shifts, Scan Records, Alerts
 */
async function generateExcelReportBuffer(db) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sulfide Sentinels H2S Exposure Monitoring System';
  workbook.lastModifiedBy = 'Sulfide Sentinels System';
  workbook.created = new Date();

  // Header Styling (Bold White text on Dark Navy Fill)
  const headerStyle = {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { argb: '0284C7' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } }
    }
  };

  // Cell Border Styling
  const cellBorder = {
    top: { style: 'thin', color: { argb: 'E2E8F0' } },
    left: { style: 'thin', color: { argb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
    right: { style: 'thin', color: { argb: 'E2E8F0' } }
  };

  /**
   * Helper to build a styled worksheet with frozen headers and auto-sized columns
   */
  function buildSheet(sheetName, columns, rowsData) {
    const ws = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }]
    });

    ws.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15
    }));

    // Style Header Row
    const headerRow = ws.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });

    // Add & Style Data Rows
    rowsData.forEach((dataObj, index) => {
      const row = ws.addRow(dataObj);
      row.height = 20;

      // Alternating row background (zebra striping)
      const isEven = index % 2 === 0;
      const rowBg = isEven ? 'FFFFFF' : 'F8FAFC';

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = cellBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };

        const colDef = columns[colNumber - 1];
        if (colDef && colDef.align) {
          cell.alignment = { vertical: 'middle', horizontal: colDef.align };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        if (colDef && colDef.numFormat) {
          cell.numFmt = colDef.numFormat;
        }
      });
    });

    // Auto-calculate column widths
    ws.columns.forEach((column) => {
      let maxLen = column.header ? column.header.toString().length : 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.value !== null && cell.value !== undefined) {
          const str = cell.value.toString();
          if (str.length > maxLen) {
            maxLen = str.length;
          }
        }
      });
      column.width = Math.min(Math.max(maxLen + 4, 12), 48);
    });

    return ws;
  }

  // 1. WORKERS WORKSHEET
  const workers = db.prepare("SELECT * FROM workers ORDER BY id ASC").all();
  buildSheet(
    'Workers',
    [
      { header: 'ID', key: 'id', width: 8, align: 'center' },
      { header: 'Worker ID', key: 'worker_id', align: 'center' },
      { header: 'Worker Name', key: 'name', align: 'left' },
      { header: 'Department', key: 'department', align: 'left' },
      { header: 'Assigned Badge ID', key: 'badge_id', align: 'center' },
      { header: 'Status', key: 'status', align: 'center' },
      { header: 'Registered Timestamp', key: 'created_at', align: 'center' }
    ],
    workers.map(w => ({
      id: w.id,
      worker_id: w.worker_id,
      name: w.name,
      department: w.department || 'General',
      badge_id: w.badge_id || 'N/A',
      status: String(w.status || 'active').toUpperCase(),
      created_at: w.created_at
    }))
  );

  // 2. BADGES WORKSHEET
  const badges = db.prepare("SELECT * FROM badges ORDER BY id ASC").all();
  buildSheet(
    'Badges',
    [
      { header: 'ID', key: 'id', width: 8, align: 'center' },
      { header: 'Badge Serial ID', key: 'badge_id', align: 'center' },
      { header: 'Manufacture Date', key: 'manufacture_date', align: 'center' },
      { header: 'Expiry Date', key: 'expiry_date', align: 'center' },
      { header: 'Status', key: 'status', align: 'center' },
      { header: 'Created At', key: 'created_at', align: 'center' }
    ],
    badges.map(b => ({
      id: b.id,
      badge_id: b.badge_id,
      manufacture_date: b.manufacture_date || 'N/A',
      expiry_date: b.expiry_date || 'N/A',
      status: String(b.status || 'active').toUpperCase(),
      created_at: b.created_at
    }))
  );

  // 3. SHIFTS WORKSHEET
  const shifts = db.prepare(`
    SELECT s.*, w.name as worker_name 
    FROM shifts s 
    LEFT JOIN workers w ON s.worker_id = w.worker_id 
    ORDER BY s.id ASC
  `).all();
  buildSheet(
    'Shifts',
    [
      { header: 'Shift ID', key: 'id', width: 10, align: 'center' },
      { header: 'Worker ID', key: 'worker_id', align: 'center' },
      { header: 'Worker Name', key: 'worker_name', align: 'left' },
      { header: 'Badge ID', key: 'badge_id', align: 'center' },
      { header: 'Shift Start Time', key: 'start_time', align: 'center' },
      { header: 'Shift End Time', key: 'end_time', align: 'center' },
      { header: 'Duration (Minutes)', key: 'duration_minutes', align: 'right', numFormat: '#,##0' },
      { header: 'Shift Status', key: 'status', align: 'center' },
      { header: 'Created At', key: 'created_at', align: 'center' }
    ],
    shifts.map(s => ({
      id: s.id,
      worker_id: s.worker_id,
      worker_name: s.worker_name || 'N/A',
      badge_id: s.badge_id,
      start_time: s.start_time,
      end_time: s.end_time || 'In Progress',
      duration_minutes: s.duration_minutes !== null ? s.duration_minutes : 0,
      status: String(s.status || 'active').toUpperCase(),
      created_at: s.created_at
    }))
  );

  // 4. SCAN RECORDS WORKSHEET
  const scans = db.prepare(`
    SELECT sc.*, w.name as worker_name 
    FROM scans sc 
    LEFT JOIN workers w ON sc.worker_id = w.worker_id 
    ORDER BY sc.id ASC
  `).all();
  buildSheet(
    'Scan Records',
    [
      { header: 'Scan ID', key: 'id', width: 10, align: 'center' },
      { header: 'Worker ID', key: 'worker_id', align: 'center' },
      { header: 'Worker Name', key: 'worker_name', align: 'left' },
      { header: 'Shift ID', key: 'shift_id', align: 'center' },
      { header: 'Scan Type', key: 'scan_type', align: 'center' },
      { header: 'Detected Color', key: 'detected_color', align: 'center' },
      { header: 'Exposure Estimate (ppm-h)', key: 'exposure_estimate', align: 'right', numFormat: '0.00' },
      { header: 'Unit', key: 'unit', align: 'center' },
      { header: 'Confidence (%)', key: 'confidence', align: 'right', numFormat: '0.0%' },
      { header: 'Quality Gate', key: 'quality', align: 'center' },
      { header: 'Analysis Status', key: 'status', align: 'center' },
      { header: 'Analysis Notes / Warnings', key: 'analysis_notes', align: 'left' },
      { header: 'Scan Timestamp', key: 'created_at', align: 'center' }
    ],
    scans.map(sc => ({
      id: sc.id,
      worker_id: sc.worker_id,
      worker_name: sc.worker_name || 'N/A',
      shift_id: sc.shift_id || 'N/A',
      scan_type: String(sc.scan_type || 'pre_shift').toUpperCase(),
      detected_color: sc.detected_color || 'N/A',
      exposure_estimate: sc.exposure_estimate !== null ? sc.exposure_estimate : 0,
      unit: sc.unit || 'ppm-h',
      confidence: sc.confidence !== null ? (sc.confidence > 1 ? sc.confidence / 100 : sc.confidence) : 0,
      quality: sc.quality || 'pass',
      status: String(sc.status || 'completed').toUpperCase(),
      analysis_notes: sc.analysis_notes || '',
      created_at: sc.created_at
    }))
  );

  // 5. ALERTS WORKSHEET
  const alerts = db.prepare(`
    SELECT a.*, w.name as worker_name 
    FROM alerts a 
    LEFT JOIN workers w ON a.worker_id = w.worker_id 
    ORDER BY a.id ASC
  `).all();
  buildSheet(
    'Alerts',
    [
      { header: 'Alert ID', key: 'id', width: 10, align: 'center' },
      { header: 'Target Role', key: 'target_role', align: 'center' },
      { header: 'Worker ID', key: 'worker_id', align: 'center' },
      { header: 'Worker Name', key: 'worker_name', align: 'left' },
      { header: 'Alert Type', key: 'alert_type', align: 'center' },
      { header: 'Severity Level', key: 'severity', align: 'center' },
      { header: 'Alert Title', key: 'title', align: 'left' },
      { header: 'Message Details', key: 'message', align: 'left' },
      { header: 'Read Status', key: 'is_read', align: 'center' },
      { header: 'Alert Timestamp', key: 'created_at', align: 'center' }
    ],
    alerts.map(a => ({
      id: a.id,
      target_role: String(a.target_role || 'all').toUpperCase(),
      worker_id: a.worker_id || 'ALL WORKERS',
      worker_name: a.worker_name || 'System Wide',
      alert_type: a.alert_type,
      severity: String(a.severity || 'info').toUpperCase(),
      title: a.title,
      message: a.message,
      is_read: a.is_read ? 'READ' : 'UNREAD',
      created_at: a.created_at
    }))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generateExcelReportBuffer };
