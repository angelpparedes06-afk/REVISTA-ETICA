/* ================================================================
   QR DINÁMICO PARA LA SECCIÓN DE REFLEXIONES
   --------------------------------------------------------------
   - Cambia la URL pública del sitio en config.js.
   - Si cambias el id de la sección de comentarios en el HTML,
     ajusta también el valor de TARGET_HASH más abajo.
   ================================================================ */

const TARGET_HASH = "#comparte-reflexion";
const QR_CONTAINER_ID = "qrImage";
const BUTTON_ID = "btnEscribirReflexion";

function construirUrlDestino() {
  const baseUrl = (SITE_URL || "").trim();

  if (baseUrl) {
    const limpia = baseUrl.replace(/\/$/, "");
    return `${limpia}${TARGET_HASH}`;
  }

  const currentUrl = window.location.href.split("#")[0];
  return `${currentUrl}${TARGET_HASH}`;
}

function actualizarQr() {
  const img = document.getElementById(QR_CONTAINER_ID);
  if (!img) return;

  const destino = construirUrlDestino();
  img.alt = `Código QR para abrir la sección de comentarios: ${destino}`;

  if (typeof QRCode === "undefined") {
    console.warn("QRCode.js no está cargado; el código QR no se pudo generar.");
    return;
  }

  QRCode.toDataURL(destino, {
    width: 260,
    margin: 1,
    color: {
      dark: "#0a0a09",
      light: "#f2ede3"
    }
  })
    .then((url) => {
      img.src = url;
    })
    .catch((error) => {
      console.error("No se pudo generar el código QR:", error);
    });
}

function abrirSeccionComentarios(event) {
  if (event) event.preventDefault();
  const destino = construirUrlDestino();
  window.location.assign(destino);
}

document.addEventListener("DOMContentLoaded", () => {
  actualizarQr();

  const boton = document.getElementById(BUTTON_ID);
  if (boton) {
    boton.addEventListener("click", abrirSeccionComentarios);
  }
});

window.addEventListener("hashchange", () => {
  actualizarQr();
});
