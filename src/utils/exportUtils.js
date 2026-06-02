import html2canvas from "html2canvas";
import jsPDF from "jspdf";

async function captureEl(el) {
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    allowTaint: true,
  });
}

function fitToPage(canvas, usableW, usableH) {
  const ratio = canvas.width / canvas.height;
  let w = usableW;
  let h = w / ratio;
  if (h > usableH) { h = usableH; w = h * ratio; }
  return { w, h };
}

export async function exportAsImage(el, filename = "export.png") {
  const canvas = await captureEl(el);
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportAsPDF(els, filename = "export.pdf") {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 8;
  const usableW = 297 - margin * 2;
  const usableH = 210 - margin * 2;

  for (let i = 0; i < els.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = await captureEl(els[i]);
    const imgData = canvas.toDataURL("image/png");
    const { w, h } = fitToPage(canvas, usableW, usableH);
    const x = margin + (usableW - w) / 2;
    const y = margin + (usableH - h) / 2;
    pdf.addImage(imgData, "PNG", x, y, w, h);
  }
  pdf.save(filename);
}
