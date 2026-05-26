// src/utils/pdfExport.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function exportReportPDF({ title, subtitle, summary, tableData, columns, period }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 200, 100);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, 14);
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 230);
  doc.text(subtitle || '', 15, 22);
  doc.text(`พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}`, 150, 22, { align: 'right' });

  // Summary boxes
  let y = 38;
  doc.setTextColor(30, 30, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('สรุปภาพรวม', 15, y);
  y += 6;

  const summaryItems = Object.entries(summary);
  const boxW = 55, boxH = 18, gap = 5, startX = 15;
  summaryItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = startX + col * (boxW + gap);
    const by = y + row * (boxH + gap);
    doc.setFillColor(245, 246, 255);
    doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'F');
    doc.setDrawColor(200, 210, 240);
    doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'S');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(item[0], bx + boxW / 2, by + 6, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item[1].toLocaleString()), bx + boxW / 2, by + 14, { align: 'center' });
  });

  const summaryRows = Math.ceil(summaryItems.length / 3);
  y += summaryRows * (boxH + gap) + 10;

  // Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 50);
  doc.text('รายละเอียด', 15, y);
  y += 4;

  doc.autoTable({
    startY: y,
    head: [columns.map(c => c.label)],
    body: tableData.map(row => columns.map(c => row[c.key] ?? '')),
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [26, 26, 46], textColor: [255, 200, 100], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 255] },
    margin: { left: 15, right: 15 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`หน้า ${i} / ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('ระบบบริหารจัดการแอดมินเพจ', 15, 290);
  }

  doc.save(`รายงาน_${period || 'all'}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportPersonalPDF({ user, entries, total, period }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 200, 100);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`รายงานรายบุคคล: ${user.displayName || user.email}`, 15, 14);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 220);
  doc.text(`ช่วงเวลา: ${period} | พิมพ์: ${new Date().toLocaleDateString('th-TH')}`, 15, 23);

  let y = 40;
  const stats = [
    ['ข้อความทั้งหมด', total.messages],
    ['ตอบกลับ', total.responses],
    ['ผู้ติดตามใหม่', total.followers],
    ['โพสต์', total.posts],
    ['Reach', total.reach],
    ['Engagement', total.engagement],
  ];
  const bw = 55, bh = 18, gap = 5;
  stats.forEach((s, i) => {
    const c = i % 3, r = Math.floor(i / 3);
    const bx = 15 + c * (bw + gap), by = y + r * (bh + gap);
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(bx, by, bw, bh, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 150);
    doc.text(s[0], bx + bw/2, by + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(String(s[1].toLocaleString()), bx + bw/2, by + 14, { align: 'center' });
  });
  y += 2 * (bh + gap) + 12;

  doc.autoTable({
    startY: y,
    head: [['วันที่', 'เพจ', 'ข้อความ', 'ตอบ', 'ผู้ติดตาม', 'โพสต์', 'Reach', 'Engagement', 'หมายเหตุ']],
    body: entries.map(e => [e.date, e.pageName, e.messageCount, e.responseCount, e.newFollowers, e.posts, e.reach, e.engagement, e.notes]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [26, 26, 46], textColor: [255, 200, 100] },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    margin: { left: 15, right: 15 },
  });

  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`หน้า ${i}/${pc}`, 105, 290, { align: 'center' });
  }

  doc.save(`สรุปบุคคล_${user.email}_${new Date().toISOString().split('T')[0]}.pdf`);
}
