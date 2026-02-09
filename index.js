/**
 * CONFIGURACIÓN INICIAL
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbw0uEC9Uso6e0SSSZRQu-in3pZll3qNf9KGFDxxnqtiduD0qphErlRaBKUExGQ66Q6B2g/exec';

let userData = { rol: "", nombre: "" };
let currentData = [];
let isNewRecord = false;
let filterDates = []; // [DateStart, DateEnd]

// Pagination variables
let currentPage = 1;
const recordsPerPage = 10;

// Listas desplegables configurables
const OPCIONES = {
  3: ["OSE online", "OSE presencial", "OSE ambos", "Registros", "Titulación", "OSE retención", "OSE seguimiento"],
  6: ["Marketing", "Utility"],
  9: ["Pendiente", "Completado", "Observado", "A la espera"]
};

const SESSION_TIMEOUT = 5 * 60 * 60 * 1000;

/**
 * GESTIÓN DE SESIÓN
 */
function saveSession(data) {
  localStorage.setItem('zoho_user_session', JSON.stringify({
    user: data,
    loginTime: Date.now()
  }));
}

function getSession() {
  const sessionRaw = localStorage.getItem('zoho_user_session');
  if (!sessionRaw) return null;
  const session = JSON.parse(sessionRaw);
  if (Date.now() - session.loginTime > SESSION_TIMEOUT) {
    localStorage.removeItem('zoho_user_session');
    return null;
  }
  return session.user;
}

function clearSession() {
  localStorage.removeItem('zoho_user_session');
  location.reload();
}

/**
 * COMUNICACIÓN CON EL SERVIDOR
 */
async function callAPI(payload) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.remove('hidden');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const res = await response.json();
    if (loader) loader.classList.add('hidden');
    return res;
  } catch (e) {
    if (loader) loader.classList.add('hidden');
    console.error("Error API:", e);
    Swal.fire({
      icon: 'error',
      title: 'Error de Conexión',
      text: 'No se pudo conectar con la base de datos de Google.'
    });
  }
}

/**
 * LOGIN
 */
async function attemptLogin() {
  const user = document.getElementById('userInput').value;
  const pass = document.getElementById('passInput').value;
  if (!user || !pass) return Swal.fire('Error', 'Por favor, ingrese sus credenciales.', 'warning');
  const res = await callAPI({ action: 'login', user, pass });
  if (res && res.success) {
    saveSession(res);
    showDashboard(res);
  } else {
    document.getElementById('loginError').innerText = res ? res.message : "Error de conexión.";
  }
}

window.onload = function () {
  const user = getSession();
  if (user) showDashboard(user);
  else document.getElementById('loginSection').classList.remove('hidden');
};

function showDashboard(res) {
  userData = res;
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('mainSection').classList.remove('hidden');
  document.getElementById('rolBadge').innerText = `SESIÓN: ${res.nombre.toUpperCase()} | ROL: ${res.rol}`;
  if (res.rol.startsWith("OSE_")) document.getElementById('btnNuevo').classList.remove('hidden');
  initFilters();
  loadData();
  setupCopyButtons();
}

/**
 * Setup event delegation for copy buttons
 */
function setupCopyButtons() {
  document.addEventListener('click', function (e) {
    if (e.target.closest('.copy-btn')) {
      e.stopPropagation();
      const btn = e.target.closest('.copy-btn');
      const encodedText = btn.getAttribute('data-copy-text');
      const fieldName = btn.getAttribute('data-field-name');
      const text = decodeURIComponent(encodedText);
      copyToClipboard(text, fieldName);
    }
  });
}

/**
 * GESTIÓN DE FILTROS
 */
function initFilters() {
  $('#dateRangeFilter').daterangepicker({
    autoUpdateInput: false,
    locale: {
      cancelLabel: 'Limpiar',
      applyLabel: 'Aplicar',
      format: 'DD/MM/YYYY',
      daysOfWeek: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
      monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    }
  });

  $('#dateRangeFilter').on('apply.daterangepicker', function (ev, picker) {
    $(this).val(picker.startDate.format('DD/MM/YYYY') + ' - ' + picker.endDate.format('DD/MM/YYYY'));
    filterDates = [picker.startDate.toDate(), picker.endDate.toDate()];
    currentPage = 1; // Reset to page 1
    renderTable();
  });

  $('#dateRangeFilter').on('cancel.daterangepicker', function (ev, picker) {
    $(this).val('');
    filterDates = [];
    currentPage = 1; // Reset to page 1
    renderTable();
  });
}

function clearFilters() {
  // Limpiar DateRangePicker
  $('#dateRangeFilter').val('');
  filterDates = [];

  const nameInput = document.getElementById('nameFilter');
  if (nameInput) nameInput.value = "";

  const statusInput = document.getElementById('statusFilter');
  if (statusInput) statusInput.value = "";

  const brandInput = document.getElementById('brandFilter');
  if (brandInput) brandInput.value = "";

  currentPage = 1; // Reset to page 1
  renderTable();
}

/**
 * Carga datos del servidor (Solo sucede al inicio o guardar)
 */
/**
 * Carga datos del servidor (Solo sucede al inicio o guardar)
 */
async function loadData() {
  const res = await callAPI({ action: 'getData', rol: userData.rol });
  if (res && res.success) {
    currentData = res.data;
    renderTable();
  }
}

/**
 * Muestra u oculta la fila de detalles
 * @param {number} index Índice de la fila
 */
function toggleRow(index) {
  const row = document.getElementById(`detail-${index}`);
  const mainRow = document.querySelector(`.clickable-row[onclick="toggleRow(${index})"]`);
  const icon = document.getElementById(`icon-${index}`);

  if (row) {
    if (row.classList.contains('show')) {
      row.classList.remove('show');
      if (mainRow) mainRow.classList.remove('expanded');
      if (icon) {
        icon.classList.remove('fa-minus-circle');
        icon.classList.add('fa-plus-circle');
      }
    } else {
      row.classList.add('show');
      if (mainRow) mainRow.classList.add('expanded');
      if (icon) {
        icon.classList.remove('fa-plus-circle');
        icon.classList.add('fa-minus-circle');
      }
    }
  }
}

/**
 * COPY TO CLIPBOARD
 */
function copyToClipboard(text, fieldName) {
  if (!text || text.trim() === '') {
    Swal.fire({
      icon: 'warning',
      title: 'Campo vacío',
      text: `No hay contenido para copiar en ${fieldName}.`,
      timer: 2000,
      showConfirmButton: false
    });
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    Swal.fire({
      icon: 'success',
      title: '¡Copiado!',
      text: `${fieldName} copiado al portapapeles.`,
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  }).catch(err => {
    console.error('Error al copiar:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo copiar el contenido.',
      timer: 2000
    });
  });
}

async function renderTable() {

  // Usamos currentData que ya está en memoria
  if (currentData.length > 0) {
    const isSoporte = userData.rol === "SOPORTE";
    const headerElement = document.getElementById('tableHeader');
    const bodyElement = document.getElementById('tableBody');

    // 1. Definición de Encabezados
    let headerHtml = `<tr>
        <th class="ps-4">FECHA SOLICITUD</th>
        <th class="text-center">MARCA</th>
        <th class="text-center">OFICINA</th>
        <th>NOMBRE PLANTILLA ZOHO</th>
        <th class="text-center">CATEGORÍA</th>
        <th class="text-center">ESTADO</th>
        <th class="text-center">ACCIÓN</th>
    </tr>`;

    if (isSoporte) {
      headerHtml = `<tr><th>ID</th><th>FECHA SOLICITUD</th><th class="text-center">MARCA</th><th class="text-center">OFICINA</th><th>NOMBRE PLANTILLA ZOHO</th><th class="text-center">CATEGORÍA</th><th class="text-center">ESTADO</th><th class="text-center">ACCIÓN</th></tr>`;
    }
    headerElement.innerHTML = headerHtml;

    // 2. Filtrar datos primero
    let filteredData = [];
    const totalCols = isSoporte ? 8 : 7;

    for (let i = 1; i < currentData.length; i++) {
      const f = currentData[i];

      // --- FILTRADO POR FECHA ---
      if (filterDates.length === 2) {
        const start = new Date(filterDates[0]);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterDates[1]);
        end.setHours(23, 59, 59, 999);

        let dateStr = f[1];
        if (!dateStr || dateStr === "---") continue;

        dateStr = dateStr.trim().split(" ")[0];
        const parts = dateStr.split(/[\/-]/);

        if (parts.length === 3) {
          const rowDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(rowDate.getTime())) {
            if (rowDate < start || rowDate > end) continue;
          }
        }
      }

      // --- FILTRADO POR NOMBRE PLANTILLA ---
      const nameFilterInput = document.getElementById('nameFilter');
      if (nameFilterInput && nameFilterInput.value.trim() !== "") {
        const filterText = nameFilterInput.value.toLowerCase();
        const templateName = (f[4] || "").toLowerCase();
        if (!templateName.includes(filterText)) continue;
      }

      // --- FILTRADO POR ESTADO ---
      const statusFilterInput = document.getElementById('statusFilter');
      if (statusFilterInput && statusFilterInput.value !== "") {
        const filterStatus = statusFilterInput.value;
        const currentStatus = (f[9] || "");
        if (currentStatus !== filterStatus) continue;
      }

      // --- FILTRADO POR MARCA ---
      const brandFilterInput = document.getElementById('brandFilter');
      if (brandFilterInput && brandFilterInput.value !== "") {
        const filterBrand = brandFilterInput.value;
        const currentBrand = (f[2] || "");
        if (currentBrand !== filterBrand) continue;
      }

      // Si pasó todos los filtros, agregar a filteredData
      filteredData.push({ index: i, data: f });
    }

    // 3. Aplicar paginación
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, totalRecords);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    // 4. Generar filas paginadas
    let bodyHtml = "";

    for (let item of paginatedData) {
      const i = item.index;
      const f = item.data;

      // --- PROCESAMIENTO DE FECHAS PARA LA VISTA ---
      // Formateamos Fecha de Solicitud
      const fechaSolicitudVisual = formatShortDate(f[1]);

      // Formateamos Fecha de Creación (f[10]). Si está vacío o es nulo, mostramos "Pendiente"
      const fechaCreacionVisual = (f[10] && f[10] !== "" && f[10] !== "---")
        ? formatShortDate(f[10])
        : "Pendiente";

      // --- ESTILOS INSTITUCIONALES ---
      let marcaClass = ""; // Clase para la fila
      let badgeClass = "badge bg-light text-dark border"; // Clase por defecto para el badge

      const brandUpper = (f[2] || "").trim().toUpperCase();
      if (brandUpper.includes("JVN") || brandUpper.includes("NEUMANN")) {
        marcaClass = "row-neumann";
        badgeClass = "badge bg-neumann border border-light";
      } else if (brandUpper.includes("IEMPRESA")) {
        marcaClass = "row-empresa";
        badgeClass = "badge bg-empresa border border-light";
      } else if (brandUpper.includes("BLACKWELL")) {
        marcaClass = "row-blackwell";
        badgeClass = "badge bg-blackwell border border-light";
      }

      // Mapeo de datos a la fila principal
      bodyHtml += `
        <tr class="clickable-row ${marcaClass}" onclick="toggleRow(${i})">
          ${isSoporte ? `<td class="fw-bold ps-4"><i id="icon-${i}" class="fas fa-plus-circle toggle-icon me-2"></i>${f[0]}</td>` : ''}
          <td class="${isSoporte ? '' : 'ps-4'}">
            ${!isSoporte ? `<i id="icon-${i}" class="fas fa-plus-circle toggle-icon me-2"></i>` : ''}
            ${fechaSolicitudVisual}
          </td>
          <td class="text-center"><span class="${badgeClass}">${f[2]}</span></td>
          <td class="col-ose text-center">${f[3]}</td>
          <td class="col-ose">${f[4]}</td>
          <td class="text-center">${f[6]}</td>
          <td class="text-center">${getStatusBadge(f[9])}</td>
          <td class="text-center" onclick="event.stopPropagation()">
            <button class="btn btn-edit btn-sm" onclick="openEdit(${i})"><i class="fas fa-edit me-1"></i> Editar</button>
          </td>
        </tr>
        
        <tr id="detail-${i}" class="detail-row">
          <td colspan="${totalCols}">
            <div class="detail-container">
              <div class="row g-4">
                <!-- Columna Izquierda: Info Alumno (Simulada con datos disponibles) -->
                <div class="col-md-6">
                  <div class="detail-card">
                    <h6 class="detail-header"><i class="fas fa-user-circle"></i> Información del Registro</h6>
                    <div class="row">
                       <div class="col-md-6 detail-field">
                         <span class="detail-label">ID Registro</span>
                         <span class="detail-value">${f[0]}</span>
                       </div>
                       <div class="col-md-6 detail-field">
                         <span class="detail-label">Fecha Creación</span>
                         <span class="detail-value">${fechaCreacionVisual}</span>
                       </div>
                       <div class="col-md-12 detail-field">
                         <span class="detail-label">Selección (OSE)</span>
                         <span class="detail-value">${f[7] || '---'}</span>
                       </div>
                    </div>
                  </div>
                </div>

                <!-- Columna Derecha: Detalles Plantilla -->
                <div class="col-md-6">
                  <div class="detail-card">
                    <h6 class="detail-header"><i class="fas fa-file-alt"></i> Detalles de la Plantilla</h6>
                    <div class="detail-field">
                      <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="detail-label">Plantilla Mensaje (OSE)</span>
                        <button class="btn btn-sm btn-outline-primary copy-btn" data-copy-text="${encodeURIComponent(f[5] || '')}" data-field-name="Plantilla OSE" title="Copiar al portapapeles">
                          <i class="fas fa-copy"></i> Copiar
                        </button>
                      </div>
                      <div class="detail-value" style="height: auto; max-height: 80px; overflow-y: auto;">${f[5]}</div>
                    </div>
                    <div class="detail-field">
                      <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="detail-label">Plantilla Final (ZOHO)</span>
                        <button class="btn btn-sm btn-outline-primary copy-btn" data-copy-text="${encodeURIComponent(f[8] || '')}" data-field-name="Plantilla ZOHO" title="Copiar al portapapeles">
                          <i class="fas fa-copy"></i> Copiar
                        </button>
                      </div>
                      <div class="detail-value" style="font-family: monospace;">${f[8] || 'Aún no generado'}</div>
                    </div>
                  </div>
                </div>

                </div>

                <!-- Fila Inferior: Observaciones (Solo si hay contenido) -->
                ${(f[11] && f[11].trim() !== "") ? `
                <div class="col-12">
                   <div class="detail-card">
                     <h6 class="detail-header obs-header"><i class="fas fa-eye"></i> Comentarios / Observaciones</h6>
                     <div class="obs-value">${f[11]}</div>
                   </div>
                </div>` : ''}
              </div>
            </div>
          </td>
        </tr>`;
    }
    bodyElement.innerHTML = bodyHtml;

    // 5. Renderizar controles de paginación
    renderPagination(totalRecords, totalPages);
  }
}

/**
 * PAGINATION CONTROLS
 */
function renderPagination(totalRecords, totalPages) {
  const paginationContainer = document.getElementById('paginationControls');
  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let html = `<nav aria-label="Navegación de tabla">
    <ul class="pagination pagination-sm justify-content-center mb-0">`;

  // Botón anterior
  html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
    <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">&laquo; Anterior</a>
  </li>`;

  // Números de página (con lógica para mostrar ... si hay muchas páginas)
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(1); return false;">1</a></li>`;
    if (startPage > 2) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<li class="page-item ${p === currentPage ? 'active' : ''}">
      <a class="page-link" href="#" onclick="changePage(${p}); return false;">${p}</a>
    </li>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a></li>`;
  }

  // Botón siguiente
  html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
    <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Siguiente &raquo;</a>
  </li>`;

  html += `</ul>
    <p class="text-center text-muted small mt-2 mb-0">Mostrando ${((currentPage - 1) * recordsPerPage) + 1} - ${Math.min(currentPage * recordsPerPage, totalRecords)} de ${totalRecords} registros</p>
  </nav>`;

  paginationContainer.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  renderTable();
}

/**
 * Helper para obtener el badge de estado
 * @param {string} status 
 */
function getStatusBadge(status) {
  if (!status) return "";
  let cssClass = "estado-pendiente"; // Default (azul claro)

  const s = status.toLowerCase();
  if (s.includes("completado")) cssClass = "estado-completado"; // Verde
  else if (s.includes("observado")) cssClass = "estado-observado"; // Amarillo
  else if (s.includes("espera")) cssClass = "estado-espera"; // Rojo

  return `<span class="estado-badge ${cssClass}">${status}</span>`;
}

/**
 * FORMULARIO
 */
function formatShortDate(fullString) {
  if (!fullString || fullString.trim() === "" || fullString === "---") return "";
  let datePart = fullString.split(" ")[0];
  let parts = datePart.split(/[\/-]/);
  if (parts.length !== 3) return datePart;
  return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
}

// Iconos para cada campo
const FIELD_ICONS = [
  "fas fa-id-card", // ID
  "fas fa-calendar-alt", // Fecha Solicitud
  "fas fa-building", // Marca
  "fas fa-map-marker-alt", // Oficina
  "far fa-file-alt", // Nombre Plantilla Zoho
  "far fa-envelope", // Plantilla OSE
  "fas fa-tag", // Categoría
  "fas fa-check-circle", // Selección
  "fas fa-file-contract", // Plantilla Zoho Final
  "fas fa-info-circle", // Estado
  "far fa-clock", // Fecha Creación
  "far fa-comment-dots" // Comentarios
];

function openEdit(index) {
  isNewRecord = (index === -1);
  const row = isNewRecord ? Array(12).fill("") : [...currentData[index]];
  const isSoporte = userData.rol === "SOPORTE";
  const isOSE = userData.rol.startsWith("OSE_");

  if (isNewRecord) {
    const marca = userData.rol.replace("OSE_", "");
    const correlativo = currentData.length;
    row[0] = `${marca}_${correlativo < 10 ? '0' + correlativo : correlativo}`;
    const today = new Date();
    row[1] = formatShortDate(`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`);
    row[2] = marca;
    row[9] = "Pendiente";
    document.getElementById("modalTitle").innerText = "Nuevo Registro";
  } else {
    document.getElementById("modalTitle").innerText = "Editar Registro";
  }

  // Limpiar contenedor de formulario
  const formContainer = document.getElementById("editForm");
  formContainer.innerHTML = "";

  const labels = ["ID", "Fecha Solicitud", "Marca", "Oficina", "Nombre Plantilla Zoho", "Plantilla OSE", "Categoría", "Selección", "Plantilla Zoho Final", "Estado", "Fecha Creación", "Comentarios"];

  labels.forEach((label, i) => {
    // Lógica de visibilidad OSE
    if (isOSE && (i > 5 && i !== 7)) return;

    let isReadOnly = "disabled";
    let extraClass = "";
    let valueToShow = row[i];

    if ((i === 1 || i === 10) && valueToShow && valueToShow !== "") {
      valueToShow = formatShortDate(valueToShow);
    }

    if (isOSE && [3, 4, 5, 7].includes(i)) isReadOnly = "";
    if (isSoporte && [2, 3, 4, 5, 6, 7, 8, 9, 11].includes(i)) isReadOnly = "";

    // Construir HTML del campo
    let fieldHtml = `<div class="col-md-6 mb-3">
               <label class="form-label"><i class="${FIELD_ICONS[i]} modal-label-icon"></i>${label}</label>`;

    if (OPCIONES[i]) {
      fieldHtml += `<select id="edit-${i}" class="form-select ${extraClass}" ${isReadOnly}>`;
      OPCIONES[i].forEach(opt => {
        fieldHtml += `<option value="${opt}" ${valueToShow == opt ? 'selected' : ''}>${opt}</option>`;
      });
      fieldHtml += `</select>`;
    } else if ([5, 8, 11].includes(i)) {
      fieldHtml += `<textarea id="edit-${i}" class="form-control ${extraClass}" rows="4" ${isReadOnly}>${valueToShow}</textarea>`;
    } else {
      fieldHtml += `<input type="text" id="edit-${i}" class="form-control ${extraClass}" value="${valueToShow}" ${isReadOnly}>`;
    }
    fieldHtml += `</div>`;

    // Ajustar campos de texto largo a ancho completo
    if ([5, 8, 11].includes(i)) {
      fieldHtml = fieldHtml.replace("col-md-6", "col-12");
    }

    formContainer.innerHTML += fieldHtml;
  });

  const editModal = new bootstrap.Modal(document.getElementById('editModal'));
  editModal.show();
}

/**
 * GUARDAR
 */
async function saveData() {
  const idValue = document.getElementById('edit-0').value;
  // Buscamos la fila original para no perder campos ocultos al servidor
  let rowData = isNewRecord ? Array(12).fill("") : [...currentData.find(r => r[0] === idValue)];

  // Solo actualizamos los campos que SI están presentes en el modal actual
  for (let i = 0; i < 12; i++) {
    const el = document.getElementById(`edit-${i}`);
    if (el) {
      rowData[i] = el.value;
    }
  }

  const res = await callAPI({
    action: 'update',
    newData: rowData,
    rol: userData.rol,
    isNew: isNewRecord
  });

  if (res && res.success) {
    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
    Swal.fire({
      icon: 'success',
      title: '¡Guardado!',
      text: 'El registro se ha actualizado correctamente. Recargando...',
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      location.reload();
    });
  } else {
    Swal.fire('Error', res ? res.message : "Error al guardar el registro.", 'error');
  }
}
