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
  3: ["Área de cobranzas", "OSE online", "OSE presencial", "OSE ambos", "Registros", "Titulación", "OSE retención", "OSE seguimiento"],
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
async function callAPI(payload, silent = false) {
  const loader = document.getElementById('loader');
  if (loader && !silent) loader.classList.remove('hidden');
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
function togglePasswordVisibility() {
  const passInput = document.getElementById('passInput');
  const icon = document.getElementById('togglePasswordIcon');
  if (!passInput || !icon) return;

  if (passInput.type === 'password') {
    passInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

async function attemptLogin() {
  const userInput = document.getElementById('userInput');
  const passInput = document.getElementById('passInput');
  const loginError = document.getElementById('loginError');
  const btnLogin = document.getElementById('btnLogin');

  const user = userInput ? userInput.value.trim() : '';
  const pass = passInput ? passInput.value.trim() : '';

  if (!user || !pass) {
    if (loginError) {
      loginError.innerText = 'Por favor, ingrese usuario y contraseña.';
      loginError.classList.remove('hidden');
    }
    return;
  }

  if (loginError) {
    loginError.innerText = '';
    loginError.classList.add('hidden');
  }

  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Validando...';
  }

  try {
    const res = await callAPI({ action: 'login', user, pass });
    if (res && res.success) {
      saveSession(res);
      showDashboard(res);
    } else {
      if (loginError) {
        loginError.innerText = res ? res.message : "Error de credenciales o de conexión.";
        loginError.classList.remove('hidden');
      }
    }
  } finally {
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<span>INGRESAR</span><i class="fas fa-arrow-right ms-2"></i>';
    }
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
  
  // Actualizar perfil de usuario en el header
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const rolBadge = document.getElementById('rolBadge');

  if (userNameDisplay) userNameDisplay.innerText = res.nombre || 'Usuario';
  if (userRoleBadge) {
    userRoleBadge.innerText = res.rol || '';
    if (res.rol === 'SOPORTE') {
      userRoleBadge.className = 'user-role-badge role-soporte';
    } else {
      userRoleBadge.className = 'user-role-badge role-ose';
    }
  }
  if (rolBadge) rolBadge.innerText = `SESIÓN: ${res.nombre.toUpperCase()} | ROL: ${res.rol}`;

  const btnNuevo = document.getElementById('btnNuevo');
  if (btnNuevo) {
    if (res.rol && res.rol.startsWith("OSE_")) {
      btnNuevo.classList.remove('hidden');
    } else {
      btnNuevo.classList.add('hidden');
    }
  }

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
  renderSkeleton();
  const res = await callAPI({ action: 'getData', rol: userData.rol }, true);
  if (res && res.success) {
    currentData = res.data;
    renderTable();
  }
}

/**
 * RENDER SKELETON LOADER
 */
function renderSkeleton() {
  const isSoporte = userData.rol === "SOPORTE";
  const bodyElement = document.getElementById('tableBody');
  const totalCols = isSoporte ? 8 : 7;
  let html = "";

  for (let i = 0; i < 6; i++) {
    html += `<tr class="skeleton-row">`;
    for (let j = 0; j < totalCols; j++) {
      let content = `<div class="skeleton skeleton-text"></div>`;
      // Personalizar algunas celdas para que parezcan badges o botones
      if ((isSoporte && [2, 6].includes(j)) || (!isSoporte && [1, 5].includes(j))) {
        content = `<div class="skeleton skeleton-badge"></div>`;
      } else if (j === totalCols - 1) {
        content = `<div class="skeleton skeleton-btn"></div>`;
      }
      html += `<td class="text-center">${content}</td>`;
    }
    html += `</tr>`;
  }
  bodyElement.innerHTML = html;
}

/**
 * Muestra u oculta la fila de detalles
 * @param {number} index Índice de la fila
 */
function toggleRow(index) {
  const row = document.getElementById(`detail-${index}`);
  const mainRow = document.getElementById(`main-row-${index}`) || document.querySelector(`.clickable-row[onclick="toggleRow(${index})"]`);
  const icon = document.getElementById(`icon-${index}`);

  if (row) {
    if (row.classList.contains('show')) {
      row.classList.remove('show');
      if (mainRow) mainRow.classList.remove('expanded');
      if (icon) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
      }
    } else {
      row.classList.add('show');
      if (mainRow) mainRow.classList.add('expanded');
      if (icon) {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
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
      headerHtml = `<tr>
        <th class="col-id ps-4">ID</th>
        <th>FECHA SOLICITUD</th>
        <th class="text-center">MARCA</th>
        <th class="text-center">OFICINA</th>
        <th>NOMBRE PLANTILLA ZOHO</th>
        <th class="text-center">CATEGORÍA</th>
        <th class="text-center">ESTADO</th>
        <th class="text-center">ACCIÓN</th>
      </tr>`;
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
      const fechaSolicitudVisual = formatShortDate(f[1]);
      const fechaCreacionVisual = (f[10] && f[10] !== "" && f[10] !== "---")
        ? formatShortDate(f[10])
        : "Pendiente";

      // --- ESTILOS INSTITUCIONALES ---
      let marcaClass = "";
      let badgeClass = "badge-brand";

      const brandUpper = (f[2] || "").trim().toUpperCase();
      if (brandUpper.includes("JVN") || brandUpper.includes("NEUMANN")) {
        marcaClass = "row-neumann";
        badgeClass = "badge-brand brand-jvn";
      } else if (brandUpper.includes("IEMPRESA")) {
        marcaClass = "row-empresa";
        badgeClass = "badge-brand brand-iempresa";
      } else if (brandUpper.includes("BLACKWELL")) {
        marcaClass = "row-blackwell";
        badgeClass = "badge-brand brand-blackwell";
      } else if (brandUpper.includes("ITAE")) {
        marcaClass = "row-itae";
        badgeClass = "badge-brand brand-itae";
      }

      // Mapeo de datos a la fila principal
      bodyHtml += `
        <tr id="main-row-${i}" class="clickable-row ${marcaClass}" onclick="toggleRow(${i})">
          ${isSoporte ? `<td class="ps-4 col-id">
            <span class="row-expander"><i id="icon-${i}" class="fas fa-chevron-right"></i></span>
            <span class="row-id-badge">${f[0]}</span>
          </td>` : ''}
          <td class="${isSoporte ? '' : 'ps-4'}">
            ${!isSoporte ? `<span class="row-expander"><i id="icon-${i}" class="fas fa-chevron-right"></i></span>` : ''}
            <span class="row-date-text">${fechaSolicitudVisual}</span>
          </td>
          <td class="text-center"><span class="${badgeClass}">${f[2]}</span></td>
          <td class="text-center text-secondary small">${f[3]}</td>
          <td class="fw-semibold text-dark">${f[4]}</td>
          <td class="text-center"><span class="category-pill">${f[6]}</span></td>
          <td class="text-center">${getStatusBadge(f[9])}</td>
          <td class="text-center" onclick="event.stopPropagation()">
            <button class="btn btn-action-edit" onclick="openEdit(${i})"><i class="fas fa-pen-to-square me-1"></i> Editar</button>
          </td>
        </tr>
        
        <tr id="detail-${i}" class="detail-row">
          <td colspan="${totalCols}">
            <div class="detail-container">
              <div class="row g-4">
                <!-- Columna Izquierda: Info Registro -->
                <div class="col-md-6">
                  <div class="detail-card">
                    <h6 class="detail-header"><i class="fas fa-fingerprint"></i> Información del Registro</h6>
                    <div class="row g-3">
                       <div class="col-md-6 detail-field">
                         <span class="detail-label">ID Registro</span>
                         <span class="detail-value text-primary">${f[0]}</span>
                       </div>
                       <div class="col-md-6 detail-field">
                         <span class="detail-label">Fecha Creación</span>
                         <span class="detail-value">${fechaCreacionVisual}</span>
                       </div>
                       <div class="col-12 detail-field">
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
                    <div class="detail-field mb-3">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="detail-label">Plantilla Mensaje (OSE)</span>
                        <button class="btn btn-sm btn-detail-copy copy-btn" data-copy-text="${encodeURIComponent(f[5] || '')}" data-field-name="Plantilla OSE" title="Copiar al portapapeles">
                          <i class="fas fa-copy me-1"></i> Copiar
                        </button>
                      </div>
                      <div class="detail-value-box">${f[5] || '---'}</div>
                    </div>
                    <div class="detail-field">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="detail-label">Plantilla Final (ZOHO)</span>
                        <button class="btn btn-sm btn-detail-copy copy-btn" data-copy-text="${encodeURIComponent(f[8] || '')}" data-field-name="Plantilla ZOHO" title="Copiar al portapapeles">
                          <i class="fas fa-copy me-1"></i> Copiar
                        </button>
                      </div>
                      <div class="detail-value-box monospace-box">${f[8] || 'Aún no generado'}</div>
                    </div>
                  </div>
                </div>

                <!-- Fila Inferior: Observaciones (Solo si hay contenido) -->
                ${(f[11] && f[11].trim() !== "") ? `
                <div class="col-12">
                   <div class="detail-card">
                     <h6 class="detail-header obs-header"><i class="fas fa-comment-dots"></i> Comentarios y Observaciones</h6>
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
 * Helper para obtener el badge de estado moderno con dot indicator
 * @param {string} status 
 */
function getStatusBadge(status) {
  if (!status) return "";
  let cssClass = "status-pendiente";
  let dotClass = "dot-pendiente";

  const s = status.toLowerCase();
  if (s.includes("completado")) {
    cssClass = "status-completado";
    dotClass = "dot-completado";
  } else if (s.includes("observado")) {
    cssClass = "status-observado";
    dotClass = "dot-observado";
  } else if (s.includes("espera")) {
    cssClass = "status-espera";
    dotClass = "dot-espera";
  }

  return `<span class="modern-status-badge ${cssClass}"><span class="status-dot ${dotClass}"></span>${status}</span>`;
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

  const modalTitle = document.getElementById("modalTitle");
  const modalSubtitle = document.getElementById("modalSubtitle");
  const modalTitleIcon = document.getElementById("modalTitleIcon");
  const modalRecordBadge = document.getElementById("modalRecordBadge");

  if (isNewRecord) {
    const marca = userData.rol.replace("OSE_", "");
    const correlativo = currentData.length;
    row[0] = `${marca}_${correlativo < 10 ? '0' + correlativo : correlativo}`;
    const today = new Date();
    row[1] = formatShortDate(`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`);
    row[2] = marca;
    row[9] = "Pendiente";
    
    if (modalTitle) modalTitle.innerText = "Nueva Petición";
    if (modalSubtitle) modalSubtitle.innerText = "Registra una nueva solicitud de plantilla de mensajería";
    if (modalTitleIcon) modalTitleIcon.innerHTML = '<i class="fas fa-plus"></i>';
    if (modalRecordBadge) modalRecordBadge.innerText = row[0];
  } else {
    if (modalTitle) modalTitle.innerText = "Editar Registro";
    if (modalSubtitle) modalSubtitle.innerText = "Gestiona los parámetros y contenido de la plantilla";
    if (modalTitleIcon) modalTitleIcon.innerHTML = '<i class="fas fa-pen-to-square"></i>';
    if (modalRecordBadge) modalRecordBadge.innerText = row[0] || '';
  }

  // Limpiar contenedor de formulario
  const formContainer = document.getElementById("editForm");
  formContainer.innerHTML = "";

  const labels = [
    "ID Registro", 
    "Fecha Solicitud", 
    "Marca", 
    "Oficina", 
    "Nombre Plantilla Zoho", 
    "Plantilla Mensaje (OSE)", 
    "Categoría", 
    "Selección", 
    "Plantilla Final (ZOHO)", 
    "Estado", 
    "Fecha Creación", 
    "Comentarios y Observaciones"
  ];

  // Helper para generar el HTML de un campo individual
  function renderField(i, colClass = "col-md-6") {
    // Si es OSE y no debe ver este campo, no renderizar
    if (isOSE && (i > 5 && i !== 7)) return "";

    let isReadOnly = "disabled";
    let extraClass = "";
    let valueToShow = row[i] || "";

    if ((i === 1 || i === 10) && valueToShow && valueToShow !== "") {
      valueToShow = formatShortDate(valueToShow);
    }

    if (isOSE && [3, 4, 5, 7].includes(i)) isReadOnly = "";
    if (isSoporte && [2, 3, 4, 5, 6, 7, 8, 9, 11].includes(i)) isReadOnly = "";

    const isFieldDisabled = isReadOnly === "disabled";
    const readonlyClass = isFieldDisabled ? "field-readonly" : "";

    let html = `<div class="${colClass} mb-3">
      <label class="modal-form-label mb-1">
        <span class="label-title-wrapper">
          <i class="${FIELD_ICONS[i]} modal-field-icon"></i>
          <span>${labels[i]}</span>
        </span>
        ${isFieldDisabled ? '<span class="readonly-tag"><i class="fas fa-lock me-1"></i>Bloqueado</span>' : ''}
      </label>`;

    if (OPCIONES[i]) {
      html += `<select id="edit-${i}" class="form-select modal-form-control ${readonlyClass}" ${isReadOnly}>`;
      OPCIONES[i].forEach(opt => {
        html += `<option value="${opt}" ${valueToShow == opt ? 'selected' : ''}>${opt}</option>`;
      });
      html += `</select>`;
    } else if ([5, 8, 11].includes(i)) {
      const isMonospace = (i === 8) ? "monospace-textarea" : "";
      html += `<textarea id="edit-${i}" class="form-control modal-form-control ${isMonospace} ${readonlyClass}" rows="${i === 11 ? 3 : 4}" placeholder="Escribe aquí..." ${isReadOnly}>${valueToShow}</textarea>`;
    } else {
      html += `<input type="text" id="edit-${i}" class="form-control modal-form-control ${readonlyClass}" value="${valueToShow}" ${isReadOnly}>`;
    }

    html += `</div>`;
    return html;
  }

  // Construcción modular del formulario por secciones
  let formHtml = `
    <!-- Sección 1: Datos Generales -->
    <div class="modal-section-card mb-4">
      <div class="modal-section-header">
        <i class="fas fa-id-card-clip"></i>
        <span>Información General</span>
      </div>
      <div class="row g-3">
        ${renderField(0, "col-md-6")}
        ${renderField(1, "col-md-6")}
        ${renderField(2, "col-md-6")}
        ${renderField(3, "col-md-6")}
        ${renderField(4, "col-12")}
        ${renderField(6, "col-md-6")}
        ${renderField(7, "col-md-6")}
      </div>
    </div>

    <!-- Sección 2: Plantillas y Mensajería -->
    <div class="modal-section-card mb-4">
      <div class="modal-section-header">
        <i class="fas fa-comments"></i>
        <span>Contenido de las Plantillas</span>
      </div>
      <div class="row g-3">
        ${renderField(5, "col-12")}
        ${isSoporte ? renderField(8, "col-12") : ""}
      </div>
    </div>
  `;

  // Sección 3: Estado y Auditoría (Solo si es soporte o si hay campos visibles)
  if (isSoporte) {
    formHtml += `
      <div class="modal-section-card mb-2">
        <div class="modal-section-header">
          <i class="fas fa-sliders"></i>
          <span>Estado y Seguimiento</span>
        </div>
        <div class="row g-3">
          ${renderField(9, "col-md-6")}
          ${renderField(10, "col-md-6")}
          ${renderField(11, "col-12")}
        </div>
      </div>
    `;
  }

  formContainer.innerHTML = formHtml;

  const editModal = new bootstrap.Modal(document.getElementById('editModal'));
  editModal.show();
}

/**
 * GUARDAR
 */
async function saveData() {
  const edit0 = document.getElementById('edit-0');
  if (!edit0) return;
  const idValue = edit0.value;
  
  // Buscamos la fila original para no perder campos ocultos al servidor
  let rowData = isNewRecord ? Array(12).fill("") : [...currentData.find(r => r[0] === idValue)];

  // Solo actualizamos los campos que SI están presentes en el modal actual
  for (let i = 0; i < 12; i++) {
    const el = document.getElementById(`edit-${i}`);
    if (el) {
      rowData[i] = el.value;
    }
  }

  const btnModalSave = document.getElementById('btnModalSave');
  if (btnModalSave) {
    btnModalSave.disabled = true;
    btnModalSave.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';
  }

  try {
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
        text: 'El registro se ha actualizado correctamente.',
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        location.reload();
      });
    } else {
      Swal.fire('Error', res ? res.message : "Error al guardar el registro.", 'error');
    }
  } finally {
    if (btnModalSave) {
      btnModalSave.disabled = false;
      btnModalSave.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Cambios';
    }
  }
}
