/* =====================================================================
   firebase.js
   Libro de Reflexiones — integración con Firebase Firestore
   ---------------------------------------------------------------------
   Este archivo concentra TODA la configuración de Firebase y expone
   funciones separadas y comentadas para:
     1. Inicializar Firebase           → inicializarFirebase()
     2. Guardar un comentario          → guardarComentario()
     3. Leer comentarios (una vez)     → leerComentarios()
     4. Escuchar comentarios en vivo   → escucharComentariosEnTiempoReal()

   Al final del archivo se conecta esta lógica con el HTML de la sección
   «Comparte tu reflexión» (#comparte-reflexion) en index.html.

   Se usa el SDK modular de Firebase (v10) cargado directamente desde
   el CDN de Google como módulos ES — no requiere npm ni bundlers,
   por lo que el proyecto sigue abriéndose con doble clic en index.html
   (nota: los navegadores exigen que los módulos ES se sirvan por
   http/https, no por file://; si al abrir el archivo localmente el
   Libro de Reflexiones no carga, usa un servidor local simple, p. ej.
   `npx serve` o la extensión "Live Server", o publica el sitio).
   ===================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================================
   1) CONFIGURACIÓN DE FIREBASE
   ---------------------------------------------------------------------
   Reemplaza cada valor "TU_..." con los datos reales de tu proyecto.
   Los encuentras en:
   Firebase Console → ⚙️ Configuración del proyecto → General →
   "Tus apps" → SDK setup and configuration → Config.

   ⚠️ No se han escrito datos falsos ni de ejemplo: los siguientes
   marcadores DEBEN sustituirse antes de que el Libro de Reflexiones
   funcione. Mientras tanto, la interfaz mostrará un aviso amigable
   en vez de fallar en silencio (ver el bloque try/catch más abajo).
   ===================================================================== */
const firebaseConfig = {
  apiKey: "TU_API_KEY",                       // ej. "AIzaSyD-XXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  authDomain: "TU_AUTH_DOMAIN",                // ej. "tu-proyecto.firebaseapp.com"
  projectId: "TU_PROJECT_ID",                  // ej. "tu-proyecto"
  storageBucket: "TU_STORAGE_BUCKET",          // ej. "tu-proyecto.appspot.com"
  messagingSenderId: "TU_MESSAGING_SENDER_ID", // ej. "123456789012"
  appId: "TU_APP_ID",                          // ej. "1:123456789012:web:abcd1234efgh5678"
};

/* Nombre de la colección de Firestore donde se guardan las reflexiones.
   Ver la explicación completa al final de este archivo. */
const NOMBRE_COLECCION = "comentarios";

/* =====================================================================
   2) INICIALIZAR FIREBASE
   ---------------------------------------------------------------------
   Crea la app de Firebase y devuelve la instancia de Firestore lista
   para usarse. Se llama una sola vez al cargar la página.
   ===================================================================== */
function inicializarFirebase() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  return db;
}

/* =====================================================================
   3) GUARDAR COMENTARIO
   ---------------------------------------------------------------------
   Agrega un nuevo documento a la colección "comentarios".
   Recibe la instancia `db` y un objeto { nombre, comentario }.
   La fecha se genera en el servidor con serverTimestamp() para que
   el orden sea confiable sin depender del reloj del celular del
   visitante.
   Devuelve la Promise de addDoc (útil para saber cuándo terminó
   y para manejar errores desde quien la llame).
   ===================================================================== */
function guardarComentario(db, { nombre, comentario }) {
  const coleccion = collection(db, NOMBRE_COLECCION);
  return addDoc(coleccion, {
    nombre: nombre?.trim() || "Anónimo",
    comentario: comentario.trim(),
    fecha: serverTimestamp(),
  });
}

/* =====================================================================
   4) LEER COMENTARIOS (una sola vez)
   ---------------------------------------------------------------------
   Trae los comentarios existentes UNA vez (no se queda escuchando).
   Ordenados por fecha descendente (el más reciente primero).
   Útil, por ejemplo, para una carga inicial rápida o para depurar
   en la consola del navegador. La actualización EN VIVO la hace
   escucharComentariosEnTiempoReal(), más abajo.
   ===================================================================== */
async function leerComentarios(db) {
  const q = query(collection(db, NOMBRE_COLECCION), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/* =====================================================================
   5) ESCUCHAR COMENTARIOS EN TIEMPO REAL
   ---------------------------------------------------------------------
   Se suscribe a la colección "comentarios" con onSnapshot: cada vez
   que alguien publica una nueva reflexión (desde cualquier celular),
   `callback` se ejecuta de nuevo automáticamente con los datos
   actualizados, SIN recargar la página.
   Devuelve la función `unsubscribe` para poder dejar de escuchar
   si en algún momento se necesita (p. ej. al salir de la página).
   ===================================================================== */
function escucharComentariosEnTiempoReal(db, callback, onError) {
  const q = query(collection(db, NOMBRE_COLECCION), orderBy("fecha", "desc"));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const comentarios = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(comentarios);
    },
    (error) => {
      console.error("Error al escuchar comentarios en tiempo real:", error);
      if (typeof onError === "function") onError(error);
    }
  );
  return unsubscribe;
}


/* =====================================================================
   6) INTERFAZ — conecta el formulario y la lista con Firestore
   ---------------------------------------------------------------------
   Todo lo de abajo es exclusivo de esta sección nueva del sitio y no
   toca ningún otro elemento de la página ni el archivo script.js.
   ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Referencias del DOM
  const btnEscribir     = document.getElementById("btnEscribirReflexion");
  const form            = document.getElementById("formReflexion");
  const inputNombre     = document.getElementById("inputNombre");
  const inputComentario = document.getElementById("inputComentario");
  const errorComentario = document.getElementById("errorComentario");
  const contador        = document.getElementById("contadorCaracteres");
  const btnPublicar     = document.getElementById("btnPublicar");
  const btnPublicarLabel= document.getElementById("btnPublicarLabel");
  const statusMensaje   = document.getElementById("statusMensaje");
  const lista           = document.getElementById("listaReflexiones");
  const estadoLista     = document.getElementById("reflexionesEstado");

  const MAX_CARACTERES = 500;
  const idsYaMostrados = new Set(); // para animar solo las tarjetas nuevas

  /* --- Botón "Escribir reflexión": lleva directo al formulario --- */
  if (btnEscribir && form) {
    btnEscribir.addEventListener("click", () => {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      // Pequeño retraso para que el scroll termine antes de enfocar
      window.setTimeout(() => inputComentario?.focus(), 400);
    });
  }

  /* --- Contador de caracteres en vivo --- */
  if (inputComentario && contador) {
    inputComentario.addEventListener("input", () => {
      const restantes = inputComentario.value.length;
      contador.textContent = `${restantes} / ${MAX_CARACTERES}`;
      contador.classList.toggle("is-near-limit", restantes >= MAX_CARACTERES * 0.9 && restantes < MAX_CARACTERES);
      contador.classList.toggle("is-at-limit", restantes >= MAX_CARACTERES);
      if (restantes > 0) {
        errorComentario.textContent = "";
      }
    });
  }

  /* --- Mostrar un mensaje de estado temporal (éxito o error) --- */
  function mostrarStatus(mensaje, esError = false) {
    statusMensaje.textContent = mensaje;
    statusMensaje.classList.toggle("is-error", esError);
    statusMensaje.classList.add("is-visible");
    window.clearTimeout(mostrarStatus._timer);
    mostrarStatus._timer = window.setTimeout(() => {
      statusMensaje.classList.remove("is-visible");
    }, 5000);
  }

  /* --- Formatea la fecha de Firestore (Timestamp) a texto legible --- */
  function formatearFecha(fecha) {
    // Mientras el servidor confirma la escritura, `fecha` puede llegar
    // como null por un instante (escritura optimista/local) — Firestore
    // la completa automáticamente en el siguiente snapshot.
    if (!fecha || typeof fecha.toDate !== "function") return "Justo ahora";
    return fecha.toDate().toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* --- Crea el elemento HTML de una tarjeta de comentario --- */
  function crearTarjeta({ id, nombre, comentario, fecha }, esNueva) {
    const card = document.createElement("article");
    card.className = "comment-card" + (esNueva ? " comment-card--enter" : "");
    card.dataset.id = id;

    const head = document.createElement("div");
    head.className = "comment-card__head";

    const nombreEl = document.createElement("p");
    nombreEl.className = "comment-card__name";
    nombreEl.textContent = nombre || "Anónimo";

    const fechaEl = document.createElement("time");
    fechaEl.className = "comment-card__date";
    fechaEl.textContent = formatearFecha(fecha);

    head.append(nombreEl, fechaEl);

    const textoEl = document.createElement("p");
    textoEl.className = "comment-card__text";
    textoEl.textContent = comentario;

    card.append(head, textoEl);
    return card;
  }

  /* --- Vuelve a pintar la lista completa a partir de los datos de Firestore --- */
  function renderizarComentarios(comentarios) {
    lista.innerHTML = "";

    if (comentarios.length === 0) {
      const vacio = document.createElement("p");
      vacio.className = "reflect__empty";
      vacio.textContent = "Aún no hay reflexiones. Sé la primera o el primero en compartir la tuya.";
      lista.appendChild(vacio);
      idsYaMostrados.clear();
      return;
    }

    comentarios.forEach((c) => {
      const esNueva = !idsYaMostrados.has(c.id);
      idsYaMostrados.add(c.id);
      lista.appendChild(crearTarjeta(c, esNueva));
    });
  }

  /* --- Inicialización de Firebase + suscripción en tiempo real --- */
  let db;
  try {
    db = inicializarFirebase();

    escucharComentariosEnTiempoReal(
      db,
      (comentarios) => renderizarComentarios(comentarios),
      () => {
        // Suele ocurrir si las reglas de Firestore no permiten lectura,
        // o si firebaseConfig todavía tiene los valores de marcador.
        lista.innerHTML = "";
        estadoLista.textContent =
          "No se pudieron cargar las reflexiones. Verifica la configuración de Firebase en firebase.js y las reglas de Firestore.";
        lista.appendChild(estadoLista);
      }
    );
  } catch (error) {
    console.error("No se pudo inicializar Firebase:", error);
    if (lista) {
      lista.innerHTML = "";
      const aviso = document.createElement("p");
      aviso.className = "reflect__empty";
      aviso.textContent =
        "El Libro de Reflexiones aún no está conectado a Firebase. Completa firebaseConfig en firebase.js.";
      lista.appendChild(aviso);
    }
  }

  /* --- Envío del formulario --- */
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorComentario.textContent = "";

      const nombre = inputNombre.value;
      const comentario = inputComentario.value.trim();

      // Validación: no permitir comentarios vacíos
      if (comentario.length === 0) {
        errorComentario.textContent = "Escribe tu reflexión antes de publicar.";
        inputComentario.focus();
        return;
      }
      // Validación: máximo 500 caracteres (además del maxlength del textarea)
      if (comentario.length > MAX_CARACTERES) {
        errorComentario.textContent = `Tu reflexión supera el máximo de ${MAX_CARACTERES} caracteres.`;
        inputComentario.focus();
        return;
      }
      if (!db) {
        mostrarStatus("El Libro de Reflexiones aún no está conectado a Firebase.", true);
        return;
      }

      // Bloquea el botón mientras se guarda, para evitar envíos duplicados
      btnPublicar.disabled = true;
      btnPublicarLabel.textContent = "Publicando…";

      try {
        await guardarComentario(db, { nombre, comentario });
        form.reset();
        contador.textContent = `0 / ${MAX_CARACTERES}`;
        contador.classList.remove("is-near-limit", "is-at-limit");
        mostrarStatus("Gracias por compartir tu reflexión.");
      } catch (error) {
        console.error("Error al guardar el comentario:", error);
        mostrarStatus("No se pudo publicar tu reflexión. Inténtalo de nuevo.", true);
      } finally {
        btnPublicar.disabled = false;
        btnPublicarLabel.textContent = "Publicar";
      }
    });
  }
});

/* =====================================================================
   7) CÓMO CONFIGURAR FIRESTORE (colección y reglas de seguridad)
   ---------------------------------------------------------------------

   A) CREAR LA COLECCIÓN
   1. Entra a Firebase Console → tu proyecto → Firestore Database.
   2. Si es la primera vez, pulsa "Crear base de datos" y elige el modo
      (producción o prueba) y la región más cercana.
   3. La colección "comentarios" NO necesitas crearla a mano: se genera
      sola la primera vez que alguien publica una reflexión desde el
      formulario (addDoc la crea automáticamente). Si prefieres crearla
      manualmente: "Iniciar colección" → ID de la colección: comentarios
      → agrega un primer documento de prueba con los campos:
        nombre      (string)   → ej. "Visitante de prueba"
        comentario  (string)   → ej. "Reflexión de prueba"
        fecha       (timestamp)→ usa el botón de reloj para insertar
                                  la fecha/hora actual del servidor

   B) REGLAS BÁSICAS DE FIRESTORE
   Ve a Firestore Database → Reglas, y pega algo como esto para
   permitir que cualquier visitante lea y publique reflexiones,
   pero sin poder editar ni borrar las de otras personas:

   -------------------------------------------------------------------
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /comentarios/{comentarioId} {
         allow read: if true;
         allow create: if request.resource.data.comentario is string
                       && request.resource.data.comentario.size() > 0
                       && request.resource.data.comentario.size() <= 500
                       && request.resource.data.keys().hasOnly(['nombre','comentario','fecha']);
         allow update, delete: if false; // nadie edita ni borra reflexiones ajenas
       }
     }
   }
   -------------------------------------------------------------------

   Estas reglas son un punto de partida razonable para un proyecto
   escolar/expositivo: permiten lectura pública (para mostrar las
   reflexiones sin iniciar sesión) y escritura pública controlada
   (valida que el campo "comentario" exista, no esté vacío y no
   exceda 500 caracteres). Para un proyecto en producción con más
   tráfico, considera añadir autenticación anónima de Firebase
   (Authentication → Anónimo) y limitar la escritura a usuarios
   autenticados, además de reglas de límite de frecuencia (rate
   limiting) mediante Firebase App Check.
   ===================================================================== */
