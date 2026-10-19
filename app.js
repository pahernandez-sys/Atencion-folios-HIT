/**
 * Portal de Tickets y Turnos - Folios Errores HIT
 * Gestión Dual: Contratistas & Responsable de Mesa de Control PCI
 * Conexión completa con Linkaform API
 */

const LINKAFORM_CONFIG = {
  formId: 179149,
  fieldIds: {
    nombre: '6ab1478e5fe35fa36de6cb1e',
    telefono: '6ab1478e5fe35fa36de6cb1f',
    email: '6ab599c75e02297c1d2a03df',
    excel: '6ab1478e5fe35fa36de6cb21',
    numeroFolios: '6abc1b54d480ac87e62ccc17',
    descripcion: '6ace7405cb9c71e698addfc1',
    estatus: '6ab1478e5fe35fa36de6cb23'
  },
  endpoints: {
    login: 'https://app.linkaform.com/api/infosync/user_admin/login/',
    upload: 'https://app.linkaform.com/api/infosync/cloud_upload/',
    formAnswer: 'https://app.linkaform.com/api/infosync/form_answer/'
  }
};

// Configuración de los Responsables de Mesa de Control autorizados
const RESPONSABLES_CONFIG = [
  {
    id: 'pahernandez',
    nombre: 'Pablo Hernández',
    email: 'pahernandez@operacionpci.com.mx',
    apiKey: '003ab07a66c6795f8d3fcca2a3b6f94a7f06258e',
    pinHash: 'e8743787bbef7d5ffb65a3a13f7c51a90b3ce8b263b94b7bb3aeb7d35b7fa1ad' // PIN: 3546
  },
  {
    id: 'cbautista',
    nombre: 'Cristina Bautista',
    email: 'cbautista@operacionpci.com.mx',
    apiKey: '91ba1499f15482a4410b1d90a174809c52f13b1f',
    pinHash: '6a95bbab63d587b596398c4bd7e91a132f24032d2007d107e5ea71967724b092' // PIN: 7890
  }
];

async function calcularSha256(texto) {
  if (window.crypto && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallbacks seguros
  if (texto === '3546') return 'e8743787bbef7d5ffb65a3a13f7c51a90b3ce8b263b94b7bb3aeb7d35b7fa1ad';
  if (texto === '7890') return '6a95bbab63d587b596398c4bd7e91a132f24032d2007d107e5ea71967724b092';
  return 'invalido';
}

function estaAutenticadoMesa() {
  const userId = sessionStorage.getItem('mesa_usuario_id');
  if (userId) {
    const user = RESPONSABLES_CONFIG.find(r => r.id === userId);
    if (user) {
      appState.usuarioActivo = user;
      return true;
    }
  }
  appState.usuarioActivo = null;
  return false;
}

// Estado global de la aplicación
const appState = {
  activeTab: 'contratista', // 'contratista' | 'responsable'
  selectedFile: null,
  detectedFoliosCount: 0,
  isSubmitting: false,
  usuarioActivo: null, // Responsable logueado en Mesa de Control
  jwtToken: null,
  todosLosTickets: [],
  ticketsHoy: [],
  filtroResponsable: 'pendientes', // 'pendientes' | 'todos' | 'finalizados' | 'historico'
  busquedaFiltro: '',
  responsableTurnoActual: 1,
  ultimoTelefonoConsultado: null
};

// Almacén de borradores locales en edición para la Mesa de Control (evita pérdidas de texto al tipear o salir del cuadro)
let borradorRespuestas = {};
try {
  const cached = sessionStorage.getItem('mesa_borradores');
  if (cached) {
    borradorRespuestas = JSON.parse(cached);
  }
} catch (e) {
  borradorRespuestas = {};
}

function guardarBorrador(ticketId, campo, valor) {
  if (!ticketId) return;
  if (!borradorRespuestas[ticketId]) {
    borradorRespuestas[ticketId] = {};
  }
  borradorRespuestas[ticketId][campo] = valor;
  try {
    sessionStorage.setItem('mesa_borradores', JSON.stringify(borradorRespuestas));
  } catch (e) {}
}

function limpiarBorrador(ticketId) {
  if (borradorRespuestas[ticketId]) {
    delete borradorRespuestas[ticketId];
    try {
      sessionStorage.setItem('mesa_borradores', JSON.stringify(borradorRespuestas));
    } catch (e) {}
  }
}

function recopilarBorradoresActualesDelDOM() {
  if (!DOM.ticketsContainer) return;

  const textareas = DOM.ticketsContainer.querySelectorAll('textarea[id^="comentarios_"]');
  textareas.forEach(ta => {
    const tId = ta.id.replace('comentarios_', '');
    if (ta.value !== undefined && ta.value !== null) {
      if (!borradorRespuestas[tId]) borradorRespuestas[tId] = {};
      borradorRespuestas[tId].comentarios = ta.value;
    }
  });

  const inputsFolios = DOM.ticketsContainer.querySelectorAll('input[id^="inputFolios_"]');
  inputsFolios.forEach(inp => {
    const tId = inp.id.replace('inputFolios_', '');
    if (inp.value !== undefined && inp.value !== null) {
      if (!borradorRespuestas[tId]) borradorRespuestas[tId] = {};
      borradorRespuestas[tId].folios = inp.value;
    }
  });

  try {
    sessionStorage.setItem('mesa_borradores', JSON.stringify(borradorRespuestas));
  } catch (e) {}
}

// Elementos del DOM
const DOM = {
  tabContratista: document.getElementById('tabContratista'),
  tabResponsable: document.getElementById('tabResponsable'),
  badgePendientesHeader: document.getElementById('badgePendientesHeader'),
  vistaContratista: document.getElementById('vistaContratista'),
  vistaResponsable: document.getElementById('vistaResponsable'),
  fileProtocolBanner: document.getElementById('fileProtocolBanner'),
  
  // Tablero de Turnos (Contratista)
  fechaActualDisplay: document.getElementById('fechaActualDisplay'),
  turnoActualAtencionDisplay: document.getElementById('turnoActualAtencionDisplay'),
  ultimoTurnoEmitidoDisplay: document.getElementById('ultimoTurnoEmitidoDisplay'),
  tuTurnoDisplay: document.getElementById('tuTurnoDisplay'),
  tuTurnoEstadoSubtext: document.getElementById('tuTurnoEstadoSubtext'),
  btnRecargarTurnos: document.getElementById('btnRecargarTurnos'),

  // Formulario Contratista
  formContratista: document.getElementById('formContratista'),
  nombre: document.getElementById('nombre'),
  telefono: document.getElementById('telefono'),
  email: document.getElementById('email'),
  excelFile: document.getElementById('excelFile'),
  dropZone: document.getElementById('dropZone'),
  dropPrompt: document.getElementById('dropPrompt'),
  fileSelectedInfo: document.getElementById('fileSelectedInfo'),
  fileNameDisplay: document.getElementById('fileNameDisplay'),
  fileSizeDisplay: document.getElementById('fileSizeDisplay'),
  removeFileBtn: document.getElementById('removeFileBtn'),
  autoCountNotice: document.getElementById('autoCountNotice'),
  autoCountBadge: document.getElementById('autoCountBadge'),
  btnSubmitContratista: document.getElementById('btnSubmitContratista'),
  textoBtnSubmitContratista: document.getElementById('textoBtnSubmitContratista'),
  textoSubtextHorarioSubmit: document.getElementById('textoSubtextHorarioSubmit'),
  iconSubmitContratista: document.getElementById('iconSubmitContratista'),
  badgeHorarioAtencion: document.getElementById('badgeHorarioAtencion'),
  bannerFueraHorario: document.getElementById('bannerFueraHorario'),
  nombreError: document.getElementById('nombreError'),
  telefonoError: document.getElementById('telefonoError'),
  emailError: document.getElementById('emailError'),
  fileError: document.getElementById('fileError'),

  // Consulta de Estatus de Folios por Teléfono (Contratistas)
  formConsultaContratista: document.getElementById('formConsultaContratista'),
  inputConsultaTelefono: document.getElementById('inputConsultaTelefono'),
  btnBuscarConsulta: document.getElementById('btnBuscarConsulta'),
  errorConsultaTelefono: document.getElementById('errorConsultaTelefono'),
  errorConsultaTelefonoMsg: document.getElementById('errorConsultaTelefonoMsg'),
  contenedorResultadosConsulta: document.getElementById('contenedorResultadosConsulta'),
  resumenConteoConsulta: document.getElementById('resumenConteoConsulta'),
  btnCerrarConsulta: document.getElementById('btnCerrarConsulta'),
  listaResultadosConsulta: document.getElementById('listaResultadosConsulta'),

  // Vista Responsable (Mesa de Control & Histórico Linkaform)
  responsableTurnoActualText: document.getElementById('responsableTurnoActualText'),
  btnAvanzarTurno: document.getElementById('btnAvanzarTurno'),
  btnRecargarLista: document.getElementById('btnRecargarLista'),
  metricTotalHistorico: document.getElementById('metricTotalHistorico'),
  metricPendientesTotal: document.getElementById('metricPendientesTotal'),
  metricFinalizadosTotal: document.getElementById('metricFinalizadosTotal'),
  metricTotalHoy: document.getElementById('metricTotalHoy'),
  subtextFoliosHoy: document.getElementById('subtextFoliosHoy'),
  badgeConteoMostrados: document.getElementById('badgeConteoMostrados'),
  inputBuscarTicket: document.getElementById('inputBuscarTicket'),
  filtroSoloPendientes: document.getElementById('filtroSoloPendientes'),
  filtroTodos: document.getElementById('filtroTodos'),
  filtroSoloFinalizados: document.getElementById('filtroSoloFinalizados'),
  filtroHistorico: document.getElementById('filtroHistorico'),
  btnExportarExcel: document.getElementById('btnExportarExcel'),
  ticketsContainer: document.getElementById('ticketsContainer'),

  // Modales
  loadingModal: document.getElementById('loadingModal'),
  loadingTitle: document.getElementById('loadingTitle'),
  loadingMessage: document.getElementById('loadingMessage'),
  successModal: document.getElementById('successModal'),
  modalTurnoDisplay: document.getElementById('modalTurnoDisplay'),
  modalTurnoActualResponsable: document.getElementById('modalTurnoActualResponsable'),
  modalFolioDisplay: document.getElementById('modalFolioDisplay'),
  modalEmailDisplay: document.getElementById('modalEmailDisplay'),
  modalCerrarBtn: document.getElementById('modalCerrarBtn'),

  // Auth Mesa de Control
  btnCerrarSesionMesa: document.getElementById('btnCerrarSesionMesa'),
  nombreResponsableActivoDisplay: document.getElementById('nombreResponsableActivoDisplay'),
  emailResponsableActivoDisplay: document.getElementById('emailResponsableActivoDisplay'),
  modalAuthMesa: document.getElementById('modalAuthMesa'),
  formAuthMesa: document.getElementById('formAuthMesa'),
  inputPinMesa: document.getElementById('inputPinMesa'),
  btnToggleVerPin: document.getElementById('btnToggleVerPin'),
  iconVerPin: document.getElementById('iconVerPin'),
  errorPinMesa: document.getElementById('errorPinMesa'),
  btnCancelarAuthMesa: document.getElementById('btnCancelarAuthMesa')
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();
  
  verificarProtocolo();
  inicializarFecha();
  setupEventListeners();
  recuperarMiTurnoLocal();
  actualizarUIHorarioContratista();

  // Iniciar sesión y sincronizar tickets desde Linkaform
  await sincronizarTicketsYTurnos();

  // Actualización automática periódica cada 20 segundos
  setInterval(async () => {
    actualizarUIHorarioContratista();
    await sincronizarTicketsYTurnos(true);
  }, 20000);
});

function verificarProtocolo() {
  if (window.location.protocol === 'file:' && DOM.fileProtocolBanner) {
    DOM.fileProtocolBanner.classList.remove('hidden');
  }
}

function inicializarFecha() {
  const hoy = new Date();
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  DOM.fechaActualDisplay.textContent = hoy.toLocaleDateString('es-MX', opciones);
}

function getHoyDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Verifica si el momento actual está dentro del horario de atención para Contratistas:
 * Lunes a Viernes de 09:00 a 17:00 hrs (Horario Central México)
 */
function verificarHorarioAtencionContratistas() {
  try {
    const ahora = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      hour12: false,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric'
    });
    const parts = formatter.formatToParts(ahora);
    const partMap = {};
    parts.forEach(p => partMap[p.type] = p.value);

    const weekday = partMap.weekday; // "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);

    const esDiaHabil = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
    const esHoraHabil = (hour >= 9 && hour < 17); // 9:00 a 16:59:59 (de 9 a 5)

    return {
      abierto: esDiaHabil && esHoraHabil,
      dia: weekday,
      hora: hour,
      minuto: minute
    };
  } catch (e) {
    const ahora = new Date();
    const dia = ahora.getDay();
    const hora = ahora.getHours();
    return {
      abierto: (dia >= 1 && dia <= 5 && hora >= 9 && hora < 17),
      dia,
      hora,
      minuto: ahora.getMinutes()
    };
  }
}

/**
 * Actualiza la UI del formulario de contratista según el horario de recepción
 */
function actualizarUIHorarioContratista() {
  const horario = verificarHorarioAtencionContratistas();

  if (DOM.badgeHorarioAtencion) {
    if (horario.abierto) {
      DOM.badgeHorarioAtencion.innerHTML = `
        <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Recepción Abierta (09:00 - 17:00 hrs)</span>
        </span>
      `;
    } else {
      DOM.badgeHorarioAtencion.innerHTML = `
        <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Recepción Cerrada (Lun-Vie 9:00 a 17:00)</span>
        </span>
      `;
    }
  }

  if (DOM.bannerFueraHorario) {
    if (horario.abierto) {
      DOM.bannerFueraHorario.classList.add('hidden');
    } else {
      DOM.bannerFueraHorario.classList.remove('hidden');
    }
  }

  if (DOM.btnSubmitContratista) {
    if (horario.abierto) {
      if (!appState.isSubmitting) {
        DOM.btnSubmitContratista.disabled = false;
      }
      DOM.btnSubmitContratista.className = 'w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed';
      if (DOM.textoBtnSubmitContratista) {
        DOM.textoBtnSubmitContratista.textContent = 'Subir Error y Obtener Turno';
      }
      if (DOM.iconSubmitContratista) {
        DOM.iconSubmitContratista.setAttribute('data-lucide', 'send');
      }
      if (DOM.textoSubtextHorarioSubmit) {
        DOM.textoSubtextHorarioSubmit.innerHTML = 'Se registrará en Linkaform con estatus <strong>En Progreso</strong>.';
      }
    } else {
      DOM.btnSubmitContratista.disabled = true;
      DOM.btnSubmitContratista.className = 'w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-200 text-slate-500 font-semibold text-sm shadow-none cursor-not-allowed flex items-center justify-center space-x-2 border border-slate-300';
      if (DOM.textoBtnSubmitContratista) {
        DOM.textoBtnSubmitContratista.textContent = 'Recepción Cerrada (Lun-Vie 9 a 5)';
      }
      if (DOM.iconSubmitContratista) {
        DOM.iconSubmitContratista.setAttribute('data-lucide', 'clock');
      }
      if (DOM.textoSubtextHorarioSubmit) {
        DOM.textoSubtextHorarioSubmit.innerHTML = 'El registro de nuevos folios opera de <strong>Lunes a Viernes de 09:00 a 17:00 hrs</strong>.';
      }
    }
  }

  // Deshabilitar campos del formulario si está cerrado
  const campos = [DOM.nombre, DOM.telefono, DOM.email, DOM.excelFile];
  campos.forEach(c => {
    if (c) c.disabled = !horario.abierto;
  });

  if (DOM.dropZone) {
    if (horario.abierto) {
      DOM.dropZone.classList.remove('opacity-50', 'pointer-events-none');
    } else {
      DOM.dropZone.classList.add('opacity-50', 'pointer-events-none');
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Autenticación silenciosa en Linkaform con credenciales de administración
 */
async function autenticarLinkaform(force = false) {
  try {
    const authUser = appState.usuarioActivo || RESPONSABLES_CONFIG[0];
    const sessionKey = `lkf_jwt_${authUser.id}`;

    if (!force) {
      const cachedJwt = sessionStorage.getItem(sessionKey);
      if (cachedJwt) {
        appState.jwtToken = cachedJwt;
        return cachedJwt;
      }
    }

    const response = await fetch(LINKAFORM_CONFIG.endpoints.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: authUser.email,
        api_key: authUser.apiKey
      })
    });

    if (!response.ok) {
      console.warn('Fallo al obtener JWT de Linkaform para', authUser.email, response.status);
      sessionStorage.removeItem(sessionKey);
      appState.jwtToken = null;
      return null;
    }

    const data = await response.json();
    if (data && data.jwt) {
      appState.jwtToken = data.jwt;
      sessionStorage.setItem(sessionKey, data.jwt);
      return data.jwt;
    }
  } catch (err) {
    console.error('Error de red en autenticarLinkaform:', err);
    if (appState.usuarioActivo) {
      sessionStorage.removeItem(`lkf_jwt_${appState.usuarioActivo.id}`);
    }
    appState.jwtToken = null;
  }
  return null;
}

/**
 * Sincroniza la lista de tickets desde Linkaform y calcula los turnos de manera determinista
 */
async function sincronizarTicketsYTurnos(silencioso = false) {
  if (!appState.jwtToken) {
    await autenticarLinkaform();
  }
  if (!appState.jwtToken) {
    if (appState.activeTab === 'responsable') {
      renderizarVistaResponsable();
    }
    return;
  }

  try {
    const response = await fetch(`${LINKAFORM_CONFIG.endpoints.formAnswer}?form_id=${LINKAFORM_CONFIG.formId}&limit=500`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${appState.jwtToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 440 || response.status === 401) {
        console.warn('Sesión Linkaform expirada (440/401). Renovando token...');
        sessionStorage.removeItem('lkf_jwt');
        appState.jwtToken = null;
        await autenticarLinkaform(true);
        if (appState.jwtToken) {
          // Reintentar de inmediato con el nuevo token obtenido
          return await sincronizarTicketsYTurnos(silencioso);
        }
      }
      
      if (appState.activeTab === 'responsable') {
        DOM.ticketsContainer.innerHTML = `
          <div class="p-8 text-center text-rose-800 bg-rose-50 rounded-xl m-4 border border-rose-200">
            <i data-lucide="alert-octagon" class="w-8 h-8 mx-auto mb-2 text-rose-600"></i>
            <p class="font-bold text-sm">Respuesta inesperada de Linkaform (${response.status})</p>
            <p class="text-xs text-rose-600 mt-1">No se pudieron recuperar los tickets en este momento.</p>
            <button type="button" onclick="sincronizarTicketsYTurnos()" class="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs">
              Reintentar Conexión
            </button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    const data = await response.json();
    const records = data.objects || [];
    
    // Ordenar tickets generales del más reciente al más antiguo para consulta histórica
    records.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    appState.todosLosTickets = records;

    // Identificar los tickets de hoy
    const hoyStr = getHoyDateString();
    const recordsHoy = records.filter(r => {
      if (!r.created_at) return false;
      const recDate = new Date(r.created_at * 1000);
      const recDateStr = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}-${String(recDate.getDate()).padStart(2, '0')}`;
      return recDateStr === hoyStr;
    });

    // Ordenar de más antiguo a más nuevo para asignar Turno 1, Turno 2... hoy
    recordsHoy.sort((a, b) => a.created_at - b.created_at);

    // Asignar número de turno secuencial del día a cada ticket de hoy
    recordsHoy.forEach((r, idx) => {
      r.turnoDia = idx + 1;
    });

    // Para tickets anteriores sin turno de hoy, marcar como Histórico
    records.forEach(r => {
      if (!r.turnoDia) {
        r.turnoDia = 'Histórico';
      }
    });

    appState.ticketsHoy = recordsHoy;

    // Actualizar métricas y tablero de turnos
    actualizarTableroTurnos();

    // Si hay una consulta de folios activa en la vista de contratistas, actualizarla en vivo
    if (appState.ultimoTelefonoConsultado) {
      renderizarResultadosConsulta(appState.ultimoTelefonoConsultado, true);
    }
    if (appState.activeTab === 'responsable') {
      const elementoActivo = document.activeElement;
      const usuarioInteractuandoEnTickets = elementoActivo && DOM.ticketsContainer && DOM.ticketsContainer.contains(elementoActivo);

      // Si es una sincronización periódica silenciosa y el usuario está escribiendo o interactuando en la lista,
      // solo actualizamos las métricas y badges superiores sin alterar el DOM de las tarjetas.
      if (silencioso && usuarioInteractuandoEnTickets) {
        actualizarEstilosFiltros();
      } else {
        renderizarVistaResponsable();
      }
    }

  } catch (err) {
    if (!silencioso) console.error('Error al sincronizar tickets:', err);
    if (appState.activeTab === 'responsable') {
      DOM.ticketsContainer.innerHTML = `
        <div class="p-8 text-center text-rose-800 bg-rose-50 rounded-xl m-4 border border-rose-200">
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2 text-rose-600"></i>
          <p class="font-bold text-sm">Error de conexión con Linkaform</p>
          <p class="text-xs text-rose-600 mt-1">${err.message || 'No se pudo conectar con el servidor'}</p>
          <button type="button" onclick="sincronizarTicketsYTurnos()" class="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs">
            Reintentar Conexión
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

/**
 * Actualiza el tablero de turnos (visible para contratistas)
 */
function actualizarTableroTurnos() {
  if (!appState.jwtToken && window.location.protocol === 'file:') {
    if (DOM.turnoActualAtencionDisplay) DOM.turnoActualAtencionDisplay.textContent = '--';
    if (DOM.ultimoTurnoEmitidoDisplay) DOM.ultimoTurnoEmitidoDisplay.textContent = '--';
    if (DOM.tuTurnoEstadoSubtext) DOM.tuTurnoEstadoSubtext.innerHTML = '<span class="text-amber-300">Abre <a href="http://localhost:8000" class="underline font-bold">http://localhost:8000</a></span>';
    return;
  }

  const tickets = appState.ticketsHoy || [];
  const totalHoy = tickets.length;
  if (DOM.ultimoTurnoEmitidoDisplay) DOM.ultimoTurnoEmitidoDisplay.textContent = totalHoy;

  // Encontrar el primer turno pendiente (estatus != 'finalizado')
  const primerPendiente = tickets.find(t => {
    const st = String(t.answers?.[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase();
    return st !== 'finalizado';
  });

  let turnoEnAtencion = '--';
  if (primerPendiente) {
    turnoEnAtencion = primerPendiente.turnoDia;
    appState.responsableTurnoActual = primerPendiente.turnoDia;
  } else if (totalHoy > 0) {
    turnoEnAtencion = 'Todos Finalizados';
    appState.responsableTurnoActual = totalHoy;
  } else {
    const pendientesHistoricos = (appState.todosLosTickets || []).filter(t => {
      const st = String(t.answers?.[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase();
      return st !== 'finalizado';
    });
    if (pendientesHistoricos.length > 0) {
      turnoEnAtencion = 'Revisando';
    } else {
      turnoEnAtencion = 'Al día';
    }
  }

  if (DOM.turnoActualAtencionDisplay) DOM.turnoActualAtencionDisplay.textContent = turnoEnAtencion;
  if (DOM.responsableTurnoActualText) {
    DOM.responsableTurnoActualText.textContent = typeof turnoEnAtencion === 'number' ? `#${turnoEnAtencion}` : turnoEnAtencion;
  }

  // Total de tickets pendientes (incluyendo hoy y anteriores)
  const pendientesTotal = (appState.todosLosTickets || []).filter(t => {
    const st = String(t.answers?.[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase();
    return st !== 'finalizado';
  }).length;

  if (DOM.badgePendientesHeader) {
    if (pendientesTotal > 0) {
      DOM.badgePendientesHeader.textContent = pendientesTotal;
      DOM.badgePendientesHeader.classList.remove('hidden');
    } else {
      DOM.badgePendientesHeader.classList.add('hidden');
    }
  }

  // Refrescar estado de "Tu Turno Actual"
  recuperarMiTurnoLocal();
}

/**
 * Consulta en localStorage si el contratista ya pidió turno el día de hoy
 */
function recuperarMiTurnoLocal() {
  const hoyStr = getHoyDateString();
  const turnoGuardado = localStorage.getItem(`mi_turno_${hoyStr}`);
  const folioGuardado = localStorage.getItem(`mi_folio_${hoyStr}`);

  if (turnoGuardado) {
    DOM.tuTurnoDisplay.textContent = turnoGuardado;
    
    const turnoNum = parseInt(turnoGuardado, 10);
    const turnoActualNum = parseInt(appState.responsableTurnoActual, 10);

    const miTicket = appState.ticketsHoy.find(t => t.folio === folioGuardado || t.turnoDia === turnoNum);
    const estatus = miTicket ? String(miTicket.answers[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase() : '';

    if (estatus === 'finalizado') {
      DOM.tuTurnoEstadoSubtext.innerHTML = '<span class="text-emerald-300 font-bold">✓ Tu turno fue Finalizado</span>';
    } else if (turnoActualNum === turnoNum) {
      DOM.tuTurnoEstadoSubtext.innerHTML = '<span class="text-amber-300 font-bold animate-pulse">⚡ Tu turno está siendo atendido</span>';
    } else if (turnoActualNum < turnoNum) {
      const restantes = turnoNum - turnoActualNum;
      DOM.tuTurnoEstadoSubtext.textContent = `En espera (${restantes} turno${restantes > 1 ? 's' : ''} antes de ti)`;
    } else {
      DOM.tuTurnoEstadoSubtext.textContent = 'En espera de resolución';
    }
  } else {
    DOM.tuTurnoDisplay.textContent = '--';
    DOM.tuTurnoEstadoSubtext.textContent = 'Sin turno activo hoy';
  }
}

/**
 * Oculta y enmascara un correo electrónico para privacidad en la consulta pública
 * ej. pahernandez@operacionpci.com.mx -> pah***@operacionpci.com.mx
 */
function enmascararEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0] || ''}***@${domain}`;
  }
  return `${user.slice(0, 3)}***@${domain}`;
}

/**
 * Consulta y despliega el historial completo de folios de un contratista por su número de teléfono
 */
async function consultarTicketsPorTelefono(telefono) {
  const telLimpio = String(telefono || '').replace(/\D/g, '');
  if (telLimpio.length !== 10) {
    if (DOM.errorConsultaTelefonoMsg) DOM.errorConsultaTelefonoMsg.textContent = 'Por favor ingresa tu número telefónico completo a 10 dígitos.';
    if (DOM.errorConsultaTelefono) DOM.errorConsultaTelefono.classList.remove('hidden');
    return;
  }

  if (DOM.errorConsultaTelefono) DOM.errorConsultaTelefono.classList.add('hidden');
  appState.ultimoTelefonoConsultado = telLimpio;

  if (DOM.btnBuscarConsulta) {
    DOM.btnBuscarConsulta.disabled = true;
    DOM.btnBuscarConsulta.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-1.5"></span><span>Consultando...</span>';
  }

  try {
    // Si la lista de tickets está vacía o no se ha sincronizado, consultar Linkaform
    if (!appState.todosLosTickets || appState.todosLosTickets.length === 0) {
      await sincronizarTicketsYTurnos(true);
    }
  } catch (err) {
    console.warn('Error al sincronizar tickets antes de consulta:', err);
  } finally {
    if (DOM.btnBuscarConsulta) {
      DOM.btnBuscarConsulta.disabled = false;
      DOM.btnBuscarConsulta.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i><span>Consultar Mis Folios</span>';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  renderizarResultadosConsulta(telLimpio);
}

/**
 * Renderiza la lista de folios encontrados para el contratista
 */
function renderizarResultadosConsulta(telLimpio, silencioso = false) {
  if (!DOM.contenedorResultadosConsulta || !DOM.listaResultadosConsulta) return;

  const todos = appState.todosLosTickets || [];
  const tickets = todos.filter(t => {
    const a = t.answers || {};
    const tTel = String(a[LINKAFORM_CONFIG.fieldIds.telefono] || '').replace(/\D/g, '');
    return tTel === telLimpio || tTel.endsWith(telLimpio) || (telLimpio.length >= 8 && tTel.includes(telLimpio));
  });

  // Ordenar del más reciente al más antiguo
  tickets.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  DOM.contenedorResultadosConsulta.classList.remove('hidden');

  if (tickets.length === 0) {
    if (DOM.resumenConteoConsulta) {
      DOM.resumenConteoConsulta.textContent = `Resultados para: ${telLimpio}`;
    }
    DOM.listaResultadosConsulta.innerHTML = `
      <div class="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <i data-lucide="search-x" class="w-5 h-5"></i>
        </div>
        <p class="text-xs font-bold text-slate-700">No se encontraron tickets registrados con el teléfono ${telLimpio}.</p>
        <p class="text-[11px] text-slate-400 max-w-sm mx-auto">
          Verifica haber ingresado los mismos 10 dígitos que colocaste al enviar tu reporte en el formulario.
        </p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (DOM.resumenConteoConsulta) {
    DOM.resumenConteoConsulta.innerHTML = `Historial de <strong class="text-brand-700 font-bold">${tickets.length}</strong> folio${tickets.length !== 1 ? 's' : ''} para el teléfono <strong>${telLimpio}</strong>:`;
  }

  DOM.listaResultadosConsulta.innerHTML = '';

  tickets.forEach(ticket => {
    const answers = ticket.answers || {};
    const folio = ticket.folio || ticket.id || 'Sin folio';
    const numFolios = answers[LINKAFORM_CONFIG.fieldIds.numeroFolios] || 0;
    const estatus = String(answers[LINKAFORM_CONFIG.fieldIds.estatus] || 'en_progreso').toLowerCase();
    const comentarios = answers[LINKAFORM_CONFIG.fieldIds.descripcion] || '';
    const email = answers[LINKAFORM_CONFIG.fieldIds.email] || '';
    const excelFiles = answers[LINKAFORM_CONFIG.fieldIds.excel] || [];
    const primerArchivo = Array.isArray(excelFiles) && excelFiles.length > 0 ? excelFiles[0] : null;

    const esFinalizado = estatus === 'finalizado';
    const esDeHoy = typeof ticket.turnoDia === 'number';

    let fechaHoraStr = '--';
    if (ticket.created_at) {
      const d = new Date(ticket.created_at * 1000);
      fechaHoraStr = d.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    let detalleBloque = '';
    if (esFinalizado) {
      detalleBloque = `
        <div class="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 space-y-2">
          <div class="flex items-center space-x-1.5 text-emerald-800 text-xs font-bold">
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>Folio Atendido y Finalizado</span>
          </div>
          <div class="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Comentarios de Resolución (Mesa de Control):</span>
            <p class="font-medium text-slate-800 leading-relaxed">${comentarios && comentarios !== 'Incidencia reportada por contratista.' ? comentarios : 'Incidencia regularizada y resuelta en HIT.'}</p>
          </div>
          <div class="flex flex-wrap items-center justify-between text-[11px] text-emerald-800/90 pt-0.5 gap-2">
            <span>👤 Atendido por: <strong>${ticket.updated_by_name || ticket.updated_by_email || 'Mesa de Control HIT'}</strong></span>
            ${email ? `<span>📧 Confirmación enviada a: <strong>${enmascararEmail(email)}</strong></span>` : ''}
          </div>
        </div>
      `;
    } else {
      let posicionTurnoMensaje = '';
      if (esDeHoy) {
        const miTurno = ticket.turnoDia;
        const turnoActual = appState.responsableTurnoActual || 1;
        if (turnoActual === miTurno) {
          posicionTurnoMensaje = `<span class="text-amber-900 font-bold animate-pulse">⚡ ¡Tu turno (#${miTurno}) está en atención en este momento por la Mesa de Control!</span>`;
        } else if (turnoActual < miTurno) {
          const faltan = miTurno - turnoActual;
          posicionTurnoMensaje = `Mesa de Control está atendiendo el Turno #${turnoActual}. Faltan <strong>${faltan} turno${faltan > 1 ? 's' : ''}</strong> antes del tuyo.`;
        } else {
          posicionTurnoMensaje = `Tu turno (#${miTurno}) está en revisión técnica por la responsable.`;
        }
      } else {
        posicionTurnoMensaje = `Incidencia de fecha previa en proceso de revisión por la Mesa de Control.`;
      }

      detalleBloque = `
        <div class="bg-amber-50 rounded-xl p-3.5 border border-amber-200 space-y-1.5 text-xs text-amber-900">
          <div class="flex items-center space-x-1.5 font-bold text-amber-900">
            <i data-lucide="clock" class="w-4 h-4 text-amber-600"></i>
            <span>En Proceso de Atención</span>
          </div>
          <p class="text-xs text-amber-900/90 leading-relaxed pl-5">
            ${posicionTurnoMensaje}
          </p>
          ${email ? `<p class="text-[11px] text-amber-800/80 pl-5">Al finalizar, Linkaform te notificará por correo a <strong>${enmascararEmail(email)}</strong>.</p>` : ''}
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = `p-4 rounded-xl border ${esFinalizado ? 'bg-white border-slate-200' : 'bg-white border-amber-200 shadow-2xs'} space-y-3`;
    card.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div class="flex flex-wrap items-center gap-2">
          ${esDeHoy ? `
            <span class="px-2 py-0.5 rounded-lg text-xs font-black font-mono ${esFinalizado ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
              TURNO #${ticket.turnoDia} (HOY)
            </span>
          ` : `
            <span class="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
              HISTÓRICO
            </span>
          `}
          <span class="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
            Folio: <strong>${folio}</strong>
          </span>
        </div>

        <!-- Badge Estatus -->
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${esFinalizado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'}">
          ${esFinalizado ? '✓ Finalizado' : '⚡ En Proceso'}
        </span>
      </div>

      <div class="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <span>🕒 Registro: <strong>${fechaHoraStr}</strong></span>
        <span>📊 Folios reportados: <strong>${numFolios}</strong></span>
        ${primerArchivo && primerArchivo.file_url ? `
          <a href="${primerArchivo.file_url}" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline flex items-center space-x-1 font-semibold">
            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
            <span>Descargar Excel</span>
          </a>
        ` : ''}
      </div>

      <!-- Detalle de estado / resolución -->
      ${detalleBloque}
    `;

    DOM.listaResultadosConsulta.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Limpia y oculta los resultados de la consulta de folios
 */
function limpiarConsultaContratista() {
  appState.ultimoTelefonoConsultado = null;
  if (DOM.inputConsultaTelefono) DOM.inputConsultaTelefono.value = '';
  if (DOM.errorConsultaTelefono) DOM.errorConsultaTelefono.classList.add('hidden');
  if (DOM.contenedorResultadosConsulta) DOM.contenedorResultadosConsulta.classList.add('hidden');
  if (DOM.listaResultadosConsulta) DOM.listaResultadosConsulta.innerHTML = '';
}

/**
 * Configuración de Eventos de la Interfaz
 */
function setupEventListeners() {
  // Cambio de Pestañas (Contratista vs Responsable)
  DOM.tabContratista.addEventListener('click', () => cambiarPestana('contratista'));
  DOM.tabResponsable.addEventListener('click', () => cambiarPestana('responsable'));

  // Manejo de archivo Excel del Contratista
  DOM.excelFile.addEventListener('change', handleFileSelect);
  DOM.removeFileBtn.addEventListener('click', resetFileState);

  // Drag & drop en dropZone
  ['dragenter', 'dragover'].forEach(eventName => {
    DOM.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    DOM.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.dropZone.classList.remove('drag-over');
    });
  });

  // Filtro de sólo dígitos en teléfono
  DOM.telefono.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  // Consulta de Estatus de Folios por Teléfono (Contratistas)
  if (DOM.inputConsultaTelefono) {
    DOM.inputConsultaTelefono.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (DOM.errorConsultaTelefono) DOM.errorConsultaTelefono.classList.add('hidden');
    });
  }

  if (DOM.formConsultaContratista) {
    DOM.formConsultaContratista.addEventListener('submit', (e) => {
      e.preventDefault();
      const tel = DOM.inputConsultaTelefono ? DOM.inputConsultaTelefono.value.trim() : '';
      consultarTicketsPorTelefono(tel);
    });
  }

  if (DOM.btnCerrarConsulta) {
    DOM.btnCerrarConsulta.addEventListener('click', limpiarConsultaContratista);
  }

  // Envío del Formulario Contratista
  DOM.formContratista.addEventListener('submit', handleFormSubmitContratista);

  // Actualizar Turnos manual
  DOM.btnRecargarTurnos.addEventListener('click', async () => {
    await sincronizarTicketsYTurnos();
  });

  // Cerrar Modal de Éxito
  DOM.modalCerrarBtn.addEventListener('click', () => {
    DOM.successModal.classList.add('hidden');
    DOM.formContratista.reset();
    resetFileState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Botones de la Responsable
  DOM.btnRecargarLista.addEventListener('click', async () => {
    await sincronizarTicketsYTurnos();
  });

  DOM.btnAvanzarTurno.addEventListener('click', async () => {
    const siguiente = appState.ticketsHoy.find(t => {
      const st = String(t.answers[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase();
      return st !== 'finalizado' && t.turnoDia > appState.responsableTurnoActual;
    });
    if (siguiente) {
      appState.responsableTurnoActual = siguiente.turnoDia;
      actualizarTableroTurnos();
    } else {
      alert('No hay más turnos pendientes por atender hoy.');
    }
  });

  // Filtros de la Responsable (Mesa de Control)
  if (DOM.filtroSoloPendientes) {
    DOM.filtroSoloPendientes.addEventListener('click', () => {
      appState.filtroResponsable = 'pendientes';
      actualizarEstilosFiltros();
      renderizarVistaResponsable();
    });
  }

  if (DOM.filtroTodos) {
    DOM.filtroTodos.addEventListener('click', () => {
      appState.filtroResponsable = 'todos';
      actualizarEstilosFiltros();
      renderizarVistaResponsable();
    });
  }

  if (DOM.filtroSoloFinalizados) {
    DOM.filtroSoloFinalizados.addEventListener('click', () => {
      appState.filtroResponsable = 'finalizados';
      actualizarEstilosFiltros();
      renderizarVistaResponsable();
    });
  }

  if (DOM.filtroHistorico) {
    DOM.filtroHistorico.addEventListener('click', () => {
      appState.filtroResponsable = 'historico';
      actualizarEstilosFiltros();
      renderizarVistaResponsable();
    });
  }

  // Buscador de tickets en tiempo real
  if (DOM.inputBuscarTicket) {
    DOM.inputBuscarTicket.addEventListener('input', (e) => {
      appState.busquedaFiltro = e.target.value.toLowerCase().trim();
      renderizarVistaResponsable();
    });
  }

  // Exportar histórico completo a Excel
  if (DOM.btnExportarExcel) {
    DOM.btnExportarExcel.addEventListener('click', exportarHistoricoExcel);
  }

  // Delegación de eventos en ticketsContainer para retener comentarios y folios en tiempo real
  if (DOM.ticketsContainer) {
    const capturarDatoInput = (e) => {
      const target = e.target;
      if (!target || !target.id) return;
      if (target.id.startsWith('comentarios_')) {
        const tId = target.id.replace('comentarios_', '');
        guardarBorrador(tId, 'comentarios', target.value);
      } else if (target.id.startsWith('inputFolios_')) {
        const tId = target.id.replace('inputFolios_', '');
        guardarBorrador(tId, 'folios', target.value);
      }
    };

    DOM.ticketsContainer.addEventListener('input', capturarDatoInput);
    DOM.ticketsContainer.addEventListener('change', capturarDatoInput);
    DOM.ticketsContainer.addEventListener('focusout', capturarDatoInput);
  }

  // Eventos de Autenticación de Mesa de Control (PIN 3546 o 7890)
  if (DOM.formAuthMesa) {
    DOM.formAuthMesa.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pinIngresado = DOM.inputPinMesa.value.trim();
      const hash = await calcularSha256(pinIngresado);

      const responsable = RESPONSABLES_CONFIG.find(r => r.pinHash === hash || (pinIngresado === '3546' && r.id === 'pahernandez') || (pinIngresado === '7890' && r.id === 'cbautista'));

      if (responsable) {
        sessionStorage.setItem('mesa_usuario_id', responsable.id);
        appState.usuarioActivo = responsable;
        cerrarModalAuthMesa();
        // Iniciar sesión en Linkaform con la cuenta de este responsable
        await autenticarLinkaform(true);
        cambiarPestana('responsable');
      } else {
        DOM.errorPinMesa.classList.remove('hidden');
        DOM.inputPinMesa.select();
        DOM.inputPinMesa.focus();
      }
    });
  }

  if (DOM.btnCancelarAuthMesa) {
    DOM.btnCancelarAuthMesa.addEventListener('click', cerrarModalAuthMesa);
  }

  if (DOM.btnCerrarSesionMesa) {
    DOM.btnCerrarSesionMesa.addEventListener('click', cerrarSesionMesa);
  }

  if (DOM.btnToggleVerPin) {
    DOM.btnToggleVerPin.addEventListener('click', () => {
      const isPassword = DOM.inputPinMesa.type === 'password';
      DOM.inputPinMesa.type = isPassword ? 'text' : 'password';
      DOM.iconVerPin.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
      if (window.lucide) window.lucide.createIcons();
    });
  }
}

function abrirModalAuthMesa() {
  DOM.inputPinMesa.value = '';
  DOM.errorPinMesa.classList.add('hidden');
  DOM.modalAuthMesa.classList.remove('hidden');
  setTimeout(() => DOM.inputPinMesa.focus(), 100);
}

function cerrarModalAuthMesa() {
  DOM.modalAuthMesa.classList.add('hidden');
  DOM.inputPinMesa.value = '';
  DOM.errorPinMesa.classList.add('hidden');
}

function cerrarSesionMesa() {
  sessionStorage.removeItem('mesa_usuario_id');
  appState.usuarioActivo = null;
  appState.jwtToken = null;
  if (DOM.btnCerrarSesionMesa) {
    DOM.btnCerrarSesionMesa.classList.add('hidden');
  }
  cambiarPestana('contratista');
  autenticarLinkaform();
}

/**
 * Exporta el histórico completo de Linkaform a un archivo Excel (.xlsx) con SheetJS
 */
function exportarHistoricoExcel() {
  const tickets = appState.todosLosTickets;
  if (!tickets || tickets.length === 0) {
    alert('No hay tickets en la base de datos de Linkaform para exportar.');
    return;
  }

  const filas = tickets.map(t => {
    const a = t.answers || {};
    const nombre = a[LINKAFORM_CONFIG.fieldIds.nombre] || '';
    const tel = a[LINKAFORM_CONFIG.fieldIds.telefono] || '';
    const email = a[LINKAFORM_CONFIG.fieldIds.email] || '';
    const folios = a[LINKAFORM_CONFIG.fieldIds.numeroFolios] || 0;
    const estatusRaw = String(a[LINKAFORM_CONFIG.fieldIds.estatus] || 'en_progreso').toLowerCase();
    const estatus = estatusRaw === 'finalizado' ? 'Finalizado' : 'En Progreso';
    const comentarios = a[LINKAFORM_CONFIG.fieldIds.descripcion] || '';
    const excelFiles = a[LINKAFORM_CONFIG.fieldIds.excel] || [];
    const urlArchivo = (Array.isArray(excelFiles) && excelFiles.length > 0) ? (excelFiles[0].file_url || '') : '';
    
    let fechaStr = '';
    if (t.created_at) {
      const d = new Date(t.created_at * 1000);
      fechaStr = d.toLocaleString('es-MX');
    }

    return {
      'Folio Linkaform': t.folio || t.id,
      'Fecha Creación': fechaStr,
      'Estatus': estatus,
      'Atendido Por': t.updated_by_name || t.updated_by_email || (estatus === 'Finalizado' ? 'Sin registrar' : 'Pendiente'),
      'Contratista': (nombre && nombre !== 'None' && nombre.trim() !== '') ? nombre : (email || 'Sin especificar'),
      'Teléfono': tel,
      'Correo': email,
      'Folios en Excel': folios,
      'Comentarios de Resolución': comentarios,
      'Enlace Excel Adjunto': urlArchivo
    };
  });

  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico Linkaform');
  
  const hoyStr = getHoyDateString();
  XLSX.writeFile(wb, `Historico_Folios_HIT_Linkaform_${hoyStr}.xlsx`);
}

function actualizarEstilosFiltros() {
  const activoClass = 'px-2.5 py-1 rounded-lg font-semibold bg-white text-brand-700 shadow-xs transition-colors';
  const inactivoClass = 'px-2.5 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition-colors';

  const todos = appState.todosLosTickets || [];
  const pendientesCount = todos.filter(t => String(t.answers[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase() !== 'finalizado').length;
  const hoyCount = (appState.ticketsHoy || []).length;
  const finalizadosCount = todos.filter(t => String(t.answers[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase() === 'finalizado').length;
  const totalCount = todos.length;

  if (DOM.filtroSoloPendientes) {
    DOM.filtroSoloPendientes.className = appState.filtroResponsable === 'pendientes' ? activoClass : inactivoClass;
    DOM.filtroSoloPendientes.innerHTML = `Pendientes <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">${pendientesCount}</span>`;
  }
  if (DOM.filtroTodos) {
    DOM.filtroTodos.className = appState.filtroResponsable === 'todos' ? activoClass : inactivoClass;
    DOM.filtroTodos.innerHTML = `Hoy <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">${hoyCount}</span>`;
  }
  if (DOM.filtroSoloFinalizados) {
    DOM.filtroSoloFinalizados.className = appState.filtroResponsable === 'finalizados' ? activoClass : inactivoClass;
    DOM.filtroSoloFinalizados.innerHTML = `Finalizados <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">${finalizadosCount}</span>`;
  }
  if (DOM.filtroHistorico) {
    DOM.filtroHistorico.className = appState.filtroResponsable === 'historico' ? activoClass : inactivoClass;
    DOM.filtroHistorico.innerHTML = `Todos <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">${totalCount}</span>`;
  }
}

async function cambiarPestana(tab) {
  if (tab === 'responsable' && !estaAutenticadoMesa()) {
    abrirModalAuthMesa();
    return;
  }

  appState.activeTab = tab;
  if (tab === 'contratista') {
    actualizarUIHorarioContratista();
    DOM.vistaContratista.classList.remove('hidden');
    DOM.vistaResponsable.classList.add('hidden');
    DOM.tabContratista.className = 'px-3.5 py-1.5 rounded-lg bg-white text-brand-700 shadow-xs font-semibold flex items-center space-x-1.5 transition-all';
    DOM.tabResponsable.className = 'px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 transition-all';
    if (DOM.btnCerrarSesionMesa) {
      if (estaAutenticadoMesa()) {
        DOM.btnCerrarSesionMesa.classList.remove('hidden');
      } else {
        DOM.btnCerrarSesionMesa.classList.add('hidden');
      }
    }
  } else {
    DOM.vistaContratista.classList.add('hidden');
    DOM.vistaResponsable.classList.remove('hidden');
    DOM.tabResponsable.className = 'px-3.5 py-1.5 rounded-lg bg-white text-brand-700 shadow-xs font-semibold flex items-center space-x-1.5 transition-all';
    DOM.tabContratista.className = 'px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 transition-all';
    if (DOM.btnCerrarSesionMesa) DOM.btnCerrarSesionMesa.classList.remove('hidden');
    
    // Si ya tenemos tickets cargados en memoria, renderizarlos de inmediato sin esperar
    if (appState.todosLosTickets && appState.todosLosTickets.length > 0) {
      actualizarEstilosFiltros();
      renderizarVistaResponsable();
    }
    
    await sincronizarTicketsYTurnos();
  }
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Manejo y Lectura del Archivo Excel (Conteo automático con encabezado y 1 folio por fila)
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const validExts = ['.xlsx', '.xls'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    showFileError('Formato no válido. Debe ser un archivo .xlsx o .xls');
    return;
  }

  hideFileError();
  appState.selectedFile = file;

  DOM.fileNameDisplay.textContent = file.name;
  DOM.fileSizeDisplay.textContent = formatFileSize(file.size);
  DOM.dropPrompt.classList.add('hidden');
  DOM.fileSelectedInfo.classList.remove('hidden');

  // Leer Excel con SheetJS
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      if (!rawRows || rawRows.length < 2) {
        showFileError('El archivo debe tener al menos una fila de encabezado y una fila con folio.');
        appState.detectedFoliosCount = 0;
        return;
      }

      // Regla de negocio: 1 folio por fila, omitiendo la fila 0 (encabezado)
      let count = 0;
      for (let i = 1; i < rawRows.length; i++) {
        const tieneDato = rawRows[i].some(celda => celda !== null && celda !== undefined && String(celda).trim() !== '');
        if (tieneDato) count++;
      }

      if (count === 0) {
        showFileError('No se encontraron filas con folios válidos debajo del encabezado.');
        appState.detectedFoliosCount = 0;
        return;
      }

      appState.detectedFoliosCount = count;
      DOM.autoCountBadge.textContent = `${count} folio${count > 1 ? 's' : ''}`;
      DOM.autoCountNotice.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();

    } catch (err) {
      console.error('Error al parsear Excel:', err);
      showFileError('No se pudo leer el archivo Excel.');
      appState.detectedFoliosCount = 0;
    }
  };

  reader.readAsArrayBuffer(file);
}

function resetFileState() {
  appState.selectedFile = null;
  appState.detectedFoliosCount = 0;
  DOM.excelFile.value = '';
  DOM.dropPrompt.classList.remove('hidden');
  DOM.fileSelectedInfo.classList.add('hidden');
  DOM.autoCountNotice.classList.add('hidden');
  hideFileError();
}

function showFileError(msg) {
  DOM.fileError.textContent = msg;
  DOM.fileError.classList.remove('hidden');
}

function hideFileError() {
  DOM.fileError.classList.add('hidden');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Validaciones para el formulario del Contratista (4 campos requeridos)
 */
function validarFormularioContratista() {
  let ok = true;

  if (DOM.nombre.value.trim().length < 3) {
    DOM.nombreError.classList.remove('hidden');
    DOM.nombre.classList.add('border-rose-400');
    ok = false;
  } else {
    DOM.nombreError.classList.add('hidden');
    DOM.nombre.classList.remove('border-rose-400');
  }

  if (!/^\d{10}$/.test(DOM.telefono.value.trim())) {
    DOM.telefonoError.classList.remove('hidden');
    DOM.telefono.classList.add('border-rose-400');
    ok = false;
  } else {
    DOM.telefonoError.classList.add('hidden');
    DOM.telefono.classList.remove('border-rose-400');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(DOM.email.value.trim())) {
    DOM.emailError.classList.remove('hidden');
    DOM.email.classList.add('border-rose-400');
    ok = false;
  } else {
    DOM.emailError.classList.add('hidden');
    DOM.email.classList.remove('border-rose-400');
  }

  if (!appState.selectedFile || appState.detectedFoliosCount === 0) {
    showFileError('Debes adjuntar un archivo Excel con encabezado y al menos un folio.');
    ok = false;
  } else {
    hideFileError();
  }

  return ok;
}

/**
 * Envío del ticket del contratista a Linkaform
 */
async function handleFormSubmitContratista(e) {
  e.preventDefault();

  if (appState.isSubmitting) return;

  const horario = verificarHorarioAtencionContratistas();
  if (!horario.abierto) {
    alert('⏰ Recepción de folios cerrada:\n\nEl horario para subir folios con error es de Lunes a Viernes de 09:00 a 17:00 hrs (Horario Centro).\n\nFuera de este horario puedes consultar el estatus y resolución de tus folios anteriores en el buscador superior.');
    return;
  }

  if (!validarFormularioContratista()) return;

  appState.isSubmitting = true;
  DOM.btnSubmitContratista.disabled = true;

  mostrarLoading('Cargando Archivo...', 'Subiendo archivo Excel a Linkaform...');

  try {
    // 1. Cargar archivo multipart a Linkaform
    const formData = new FormData();
    formData.append('File', appState.selectedFile);
    formData.append('field_id', LINKAFORM_CONFIG.fieldIds.excel);
    formData.append('form_id', LINKAFORM_CONFIG.formId);

    const uploadRes = await fetch(LINKAFORM_CONFIG.endpoints.upload, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error(`Error en subida de archivo (${uploadRes.status})`);
    }

    const uploadData = await uploadRes.json();
    if (!uploadData || !uploadData.file) {
      throw new Error('No se recibió la URL del archivo desde Linkaform.');
    }

    // 2. Crear Registro en Linkaform
    actualizarLoading('Generando Ticket...', 'Registrando incidencia y asignando turno...');

    const payload = {
      form_id: LINKAFORM_CONFIG.formId,
      geolocation: [],
      answers: {
        [LINKAFORM_CONFIG.fieldIds.nombre]: DOM.nombre.value.trim(),
        [LINKAFORM_CONFIG.fieldIds.telefono]: DOM.telefono.value.trim(),
        [LINKAFORM_CONFIG.fieldIds.email]: DOM.email.value.trim(),
        [LINKAFORM_CONFIG.fieldIds.excel]: [
          {
            file_name: uploadData.file_name || appState.selectedFile.name,
            file_url: uploadData.file
          }
        ],
        [LINKAFORM_CONFIG.fieldIds.numeroFolios]: appState.detectedFoliosCount,
        [LINKAFORM_CONFIG.fieldIds.descripcion]: 'Incidencia reportada por contratista.',
        [LINKAFORM_CONFIG.fieldIds.estatus]: 'en_progreso'
      }
    };

    const submitHeaders = { 'Content-Type': 'application/json' };
    if (appState.jwtToken) {
      submitHeaders['Authorization'] = `Bearer ${appState.jwtToken}`;
    }

    const submitRes = await fetch(LINKAFORM_CONFIG.endpoints.formAnswer, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify(payload)
    });

    if (!submitRes.ok) {
      const errTxt = await submitRes.text();
      throw new Error(`Error al registrar en Linkaform (${submitRes.status}): ${errTxt}`);
    }

    const createdRecord = await submitRes.json();
    const folioAsignado = createdRecord.folio || createdRecord.id || 'Registrado';

    // 3. Sincronizar tickets y calcular el Turno asignado
    await sincronizarTicketsYTurnos(true);

    let miTurnoNum = 1;
    const miRegistroIndexado = (appState.ticketsHoy || []).find(t => (t.id && createdRecord.id && t.id == createdRecord.id) || (t.folio && t.folio == folioAsignado));
    if (miRegistroIndexado && typeof miRegistroIndexado.turnoDia === 'number') {
      miTurnoNum = miRegistroIndexado.turnoDia;
    } else {
      miTurnoNum = (appState.ticketsHoy && appState.ticketsHoy.length > 0) ? appState.ticketsHoy.length : 1;
    }

    const hoyStr = getHoyDateString();
    
    // Guardar mi turno en localStorage para el día de hoy
    localStorage.setItem(`mi_turno_${hoyStr}`, miTurnoNum);
    localStorage.setItem(`mi_folio_${hoyStr}`, folioAsignado);

    ocultarLoading();

    // Mostrar modal con el Turno del día
    DOM.modalTurnoDisplay.textContent = miTurnoNum;
    DOM.modalTurnoActualResponsable.textContent = appState.responsableTurnoActual || '1';
    DOM.modalFolioDisplay.textContent = folioAsignado;
    DOM.modalEmailDisplay.textContent = DOM.email.value.trim();
    DOM.successModal.classList.remove('hidden');

    // Pre-llenar el buscador de folios para que el contratista pueda consultar con 1 clic
    if (DOM.inputConsultaTelefono && DOM.telefono.value.trim()) {
      DOM.inputConsultaTelefono.value = DOM.telefono.value.trim();
    }

    actualizarTableroTurnos();

  } catch (err) {
    console.error('Fallo en el registro:', err);
    ocultarLoading();

    if (window.location.protocol === 'file:' || (err.message && err.message.toLowerCase().includes('fetch'))) {
      alert(`⚠️ Restricción de seguridad del navegador (CORS):\n\nHas abierto el archivo directamente como "file://".\nLos navegadores bloquean peticiones a servidores externos por seguridad.\n\n👉 SOLUCIÓN:\nAbre la página en http://localhost:8000 o ejecuta 'iniciar_servidor_local.bat'.`);
    } else {
      alert(`Ocurrió un error: ${err.message || 'Error de conexión'}. Por favor intenta nuevamente.`);
    }
  } finally {
    appState.isSubmitting = false;
    DOM.btnSubmitContratista.disabled = false;
  }
}

/**
 * RENDERIZADO DE LA VISTA DE LA RESPONSABLE (MESA DE CONTROL)
 */
function renderizarVistaResponsable() {
  // Salvar primero cualquier texto de comentarios o folios que esté tipeado actualmente en el DOM
  recopilarBorradoresActualesDelDOM();

  if (!appState.jwtToken) {
    if (DOM.metricTotalHistorico) DOM.metricTotalHistorico.textContent = '--';
    if (DOM.metricPendientesTotal) DOM.metricPendientesTotal.textContent = '--';
    if (DOM.metricFinalizadosTotal) DOM.metricFinalizadosTotal.textContent = '--';
    if (DOM.metricTotalHoy) DOM.metricTotalHoy.textContent = '--';
    if (DOM.subtextFoliosHoy) DOM.subtextFoliosHoy.textContent = 'Sin conexión';

    DOM.ticketsContainer.innerHTML = `
      <div class="p-8 text-center text-amber-900 bg-amber-50 rounded-2xl m-6 border border-amber-200 shadow-xs space-y-3">
        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
          <i data-lucide="shield-alert" class="w-6 h-6"></i>
        </div>
        <h3 class="font-bold text-base text-amber-900">Restricción de Seguridad del Navegador (Modo file://)</h3>
        <p class="text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
          Has abierto el sistema directamente como un archivo local (<code>file:///...</code>). Los navegadores (Chrome, Edge) bloquean la consulta de tickets desde la API de Linkaform cuando no se ejecuta sobre un servidor web.
        </p>
        <div class="pt-2">
          <a href="http://localhost:8000" class="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm">
            <i data-lucide="external-link" class="w-4 h-4"></i>
            <span>Abrir en Servidor Local (http://localhost:8000)</span>
          </a>
        </div>
        <p class="text-[11px] text-amber-700/80">
          O ejecuta el archivo <strong>iniciar_servidor_local.bat</strong>. Al publicarlo en <strong>GitHub Pages</strong> funcionará directamente sin necesidad de servidores locales.
        </p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const ticketsHoy = appState.ticketsHoy;
  const todosTickets = appState.todosLosTickets;
  
  // Métricas Globales de Linkaform
  const totalHistorico = todosTickets.length;
  const pendientesTotal = todosTickets.filter(t => String(t.answers[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase() !== 'finalizado');
  const finalizadosTotal = todosTickets.filter(t => String(t.answers[LINKAFORM_CONFIG.fieldIds.estatus] || '').toLowerCase() === 'finalizado');
  const totalHoy = ticketsHoy.length;

  let foliosHoySum = 0;
  ticketsHoy.forEach(t => {
    const num = parseInt(t.answers[LINKAFORM_CONFIG.fieldIds.numeroFolios], 10);
    if (!isNaN(num)) foliosHoySum += num;
  });

  if (DOM.metricTotalHistorico) DOM.metricTotalHistorico.textContent = totalHistorico;
  if (DOM.metricPendientesTotal) DOM.metricPendientesTotal.textContent = pendientesTotal.length;
  if (DOM.metricFinalizadosTotal) DOM.metricFinalizadosTotal.textContent = finalizadosTotal.length;
  if (DOM.metricTotalHoy) DOM.metricTotalHoy.textContent = totalHoy;
  if (DOM.subtextFoliosHoy) DOM.subtextFoliosHoy.textContent = `Folios de hoy: ${foliosHoySum}`;

  // Mostrar datos del responsable activo en sesión
  if (appState.usuarioActivo) {
    if (DOM.nombreResponsableActivoDisplay) DOM.nombreResponsableActivoDisplay.textContent = appState.usuarioActivo.nombre;
    if (DOM.emailResponsableActivoDisplay) DOM.emailResponsableActivoDisplay.textContent = appState.usuarioActivo.email;
  }

  actualizarEstilosFiltros();

  // Filtrado de la lista según botón
  let ticketsAMostrar = [];
  if (appState.filtroResponsable === 'pendientes') {
    ticketsAMostrar = pendientesTotal;
  } else if (appState.filtroResponsable === 'todos') {
    ticketsAMostrar = ticketsHoy;
  } else if (appState.filtroResponsable === 'finalizados') {
    ticketsAMostrar = finalizadosTotal;
  } else {
    ticketsAMostrar = todosTickets;
  }

  // Filtrado por buscador en tiempo real
  if (appState.busquedaFiltro) {
    const q = appState.busquedaFiltro;
    ticketsAMostrar = ticketsAMostrar.filter(t => {
      const a = t.answers || {};
      const nombre = String(a[LINKAFORM_CONFIG.fieldIds.nombre] || '').toLowerCase();
      const folio = String(t.folio || t.id || '').toLowerCase();
      const email = String(a[LINKAFORM_CONFIG.fieldIds.email] || '').toLowerCase();
      const tel = String(a[LINKAFORM_CONFIG.fieldIds.telefono] || '').toLowerCase();
      return nombre.includes(q) || folio.includes(q) || email.includes(q) || tel.includes(q);
    });
  }

  if (DOM.badgeConteoMostrados) {
    DOM.badgeConteoMostrados.textContent = `${ticketsAMostrar.length} registro${ticketsAMostrar.length !== 1 ? 's' : ''}`;
  }

  if (ticketsAMostrar.length === 0) {
    DOM.ticketsContainer.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <i data-lucide="inbox" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
        <p class="text-sm font-semibold text-slate-700">No se encontraron tickets con este filtro.</p>
        <p class="text-xs text-slate-400 mt-1">
          ${appState.busquedaFiltro ? `No hay coincidencias para "${appState.busquedaFiltro}".` : 'Cambia de filtro o consulta el Histórico Completo.'}
        </p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Generar tarjetas de tickets
  DOM.ticketsContainer.innerHTML = '';
  ticketsAMostrar.forEach(ticket => {
    const answers = ticket.answers || {};
    const rawNombre = answers[LINKAFORM_CONFIG.fieldIds.nombre];
    const nombre = (rawNombre && rawNombre !== 'None' && String(rawNombre).trim() !== '') ? rawNombre : 'Sin nombre';
    const tel = answers[LINKAFORM_CONFIG.fieldIds.telefono] || 'Sin teléfono';
    const email = answers[LINKAFORM_CONFIG.fieldIds.email] || 'Sin correo';
    const numFolios = answers[LINKAFORM_CONFIG.fieldIds.numeroFolios] || 0;
    const estatus = String(answers[LINKAFORM_CONFIG.fieldIds.estatus] || 'en_progreso').toLowerCase();
    const comentarios = answers[LINKAFORM_CONFIG.fieldIds.descripcion] || '';
    
    // Archivo Excel adjunto
    const excelFiles = answers[LINKAFORM_CONFIG.fieldIds.excel] || [];
    const primerArchivo = Array.isArray(excelFiles) && excelFiles.length > 0 ? excelFiles[0] : null;

    const esFinalizado = estatus === 'finalizado';
    
    // Determinar valores de folios y comentarios considerando borradores
    const borrador = borradorRespuestas[ticket.id] || {};
    const valorFolios = (!esFinalizado && borrador.folios !== undefined) ? borrador.folios : numFolios;

    let valorComentarios = '';
    if (!esFinalizado && borrador.comentarios !== undefined) {
      valorComentarios = borrador.comentarios;
    } else if (esFinalizado) {
      valorComentarios = comentarios;
    } else {
      valorComentarios = (comentarios && comentarios !== 'Incidencia reportada por contratista.') ? comentarios : '';
    }

    let fechaHora = '--';
    if (ticket.created_at) {
      const d = new Date(ticket.created_at * 1000);
      fechaHora = d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    const esDeHoy = typeof ticket.turnoDia === 'number';
    const turnoLabel = esDeHoy ? `TURNO #${ticket.turnoDia} (HOY)` : 'HISTÓRICO BD';

    const card = document.createElement('div');
    card.className = `p-5 transition-colors ${esFinalizado ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40'}`;
    card.innerHTML = `
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        
        <!-- Info del Ticket -->
        <div class="space-y-2 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Turno Badge -->
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-black font-mono ${esDeHoy ? (esFinalizado ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900 border border-amber-300') : 'bg-blue-50 text-blue-700 border border-blue-200'}">
              ${turnoLabel}
            </span>

            <!-- Folio Linkaform -->
            <span class="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Folio: <strong>${ticket.folio || ticket.id}</strong>
            </span>

            <span class="text-xs text-slate-400 font-medium">🕒 ${fechaHora}</span>

            <!-- Estatus Badge -->
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${esFinalizado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'}">
              ${esFinalizado ? '✓ Atendido / Finalizado' : '⚡ Pendiente / En Progreso'}
            </span>

            ${esFinalizado && (ticket.updated_by_name || ticket.updated_by_email) ? `
              <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                👤 Atendido por: <strong>${ticket.updated_by_name || ticket.updated_by_email}</strong>
              </span>
            ` : ''}
          </div>

          <!-- Datos del Contratista -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1 text-slate-600">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Contratista</span>
              <strong class="text-slate-800">${nombre}</strong>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Teléfono</span>
              <a href="tel:${tel}" class="text-brand-600 hover:underline font-mono">${tel}</a>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Correo de Notificación</span>
              <a href="mailto:${email}" class="text-brand-600 hover:underline truncate block" title="${email}">${email}</a>
            </div>
          </div>

          <!-- Archivo Excel y Conteo -->
          <div class="flex flex-wrap items-center gap-3 pt-2 text-xs">
            ${primerArchivo && primerArchivo.file_url ? `
              <a href="${primerArchivo.file_url}" target="_blank" rel="noopener noreferrer" 
                class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 transition-colors">
                <i data-lucide="download" class="w-3.5 h-3.5 text-emerald-600"></i>
                <span class="truncate max-w-[200px]">${primerArchivo.file_name || 'Descargar Excel'}</span>
              </a>
            ` : '<span class="text-slate-400 italic text-xs">Sin archivo adjunto</span>'}

            <!-- Número de Folios (Automático / Editable) -->
            <div class="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              <span class="text-[11px] text-slate-500 font-medium">Folios en Excel:</span>
              <input type="number" id="inputFolios_${ticket.id}" value="${valorFolios}" min="1" 
                class="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                ${esFinalizado ? 'disabled' : ''}>
            </div>
          </div>
        </div>

        <!-- Zona de Resolución por la Responsable -->
        <div class="w-full lg:w-80 shrink-0 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
          <label for="comentarios_${ticket.id}" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Comentarios de Resolución:
          </label>
          <textarea id="comentarios_${ticket.id}" rows="2" placeholder="Observaciones para el contratista..."
            class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            ${esFinalizado ? 'disabled' : ''}></textarea>

          ${!esFinalizado ? `
            <button type="button" onclick="finalizarTicketDesdeWeb('${ticket.id}')"
              class="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Finalizar y Notificar por Correo</span>
            </button>
          ` : `
            <div class="text-center py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center justify-center space-x-1">
              <i data-lucide="mail-check" class="w-3.5 h-3.5"></i>
              <span>Correo enviado por Linkaform</span>
            </div>
          `}
        </div>

      </div>
    `;

    // Asignar los valores directamente a los elementos del DOM para evitar problemas de escape y retener cursor/texto
    const taElem = card.querySelector(`#comentarios_${ticket.id}`);
    if (taElem) {
      taElem.value = valorComentarios;
    }
    const inpFolioElem = card.querySelector(`#inputFolios_${ticket.id}`);
    if (inpFolioElem) {
      inpFolioElem.value = valorFolios;
    }

    DOM.ticketsContainer.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Función ejecutada cuando la Responsable hace clic en "Finalizar y Notificar"
 */
window.finalizarTicketDesdeWeb = async function(recordId) {
  if (!estaAutenticadoMesa() || !appState.usuarioActivo) {
    alert('Sesión no identificada. Por favor vuelve a ingresar a Mesa de Control con tu PIN.');
    cambiarPestana('contratista');
    return;
  }

  const responsable = appState.usuarioActivo;
  if (!confirm(`¿Deseas marcar este ticket como FINALIZADO?\n\nResponsable que atiende: ${responsable.nombre} (${responsable.email})\nLinkaform registrará que tú atendiste esta incidencia y enviará la notificación por correo al contratista.`)) {
    return;
  }

  mostrarLoading('Finalizando Ticket...', `Actualizando estatus en Linkaform como ${responsable.nombre} y enviando correo...`);

  try {
    if (!appState.jwtToken) {
      await autenticarLinkaform(true);
    }

    // 1. Obtener datos actuales del registro
    const getRes = await fetch(`${LINKAFORM_CONFIG.endpoints.formAnswer}${recordId}/`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${appState.jwtToken}` }
    });

    if (!getRes.ok) throw new Error('No se pudo recuperar el registro de Linkaform');
    const recData = await getRes.json();

    // 2. Extraer valores del formulario en pantalla o borrador
    const inputFolios = document.getElementById(`inputFolios_${recordId}`);
    const inputComentarios = document.getElementById(`comentarios_${recordId}`);

    const foliosFinal = inputFolios ? (parseInt(inputFolios.value, 10) || 1) : (borradorRespuestas[recordId]?.folios ? parseInt(borradorRespuestas[recordId].folios, 10) : 1);
    
    let comentariosFinal = '';
    if (inputComentarios && inputComentarios.value.trim()) {
      comentariosFinal = inputComentarios.value.trim();
    } else if (borradorRespuestas[recordId]?.comentarios && borradorRespuestas[recordId].comentarios.trim()) {
      comentariosFinal = borradorRespuestas[recordId].comentarios.trim();
    } else {
      comentariosFinal = 'Incidencia de folios HIT regularizada y atendida.';
    }

    // 3. Fusionar respuestas manteniendo campos requeridos (files, email, etc.)
    const answersActuales = recData.answers || {};
    answersActuales[LINKAFORM_CONFIG.fieldIds.estatus] = 'finalizado';
    answersActuales[LINKAFORM_CONFIG.fieldIds.numeroFolios] = foliosFinal;
    answersActuales[LINKAFORM_CONFIG.fieldIds.descripcion] = comentariosFinal;

    const patchPayload = {
      form_id: LINKAFORM_CONFIG.formId,
      geolocation: [],
      answers: answersActuales
    };

    // 4. Enviar PATCH a Linkaform
    const patchRes = await fetch(`${LINKAFORM_CONFIG.endpoints.formAnswer}${recordId}/`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${appState.jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchPayload)
    });

    if (!patchRes.ok) {
      const errTxt = await patchRes.text();
      throw new Error(`Error en Linkaform (${patchRes.status}): ${errTxt}`);
    }

    // Limpiar el borrador guardado para este ticket ya que ha sido finalizado con éxito
    limpiarBorrador(recordId);

    // 5. Refrescar datos
    await sincronizarTicketsYTurnos(true);
    ocultarLoading();

    const contratistaEmail = answersActuales[LINKAFORM_CONFIG.fieldIds.email] || '';
    alert(`¡Ticket Finalizado con éxito!\n\nRegistrado en Linkaform por: ${responsable.nombre} (${responsable.email})\nComentarios de resolución: "${comentariosFinal}"\nSe disparó el correo automático a: ${contratistaEmail}`);

  } catch (err) {
    console.error('Error al finalizar ticket:', err);
    ocultarLoading();
    alert(`No se pudo finalizar el ticket: ${err.message || 'Error de servidor'}`);
  }
};

function mostrarLoading(titulo, msg) {
  DOM.loadingTitle.textContent = titulo;
  DOM.loadingMessage.textContent = msg;
  DOM.loadingModal.classList.remove('hidden');
}

function actualizarLoading(titulo, msg) {
  DOM.loadingTitle.textContent = titulo;
  DOM.loadingMessage.textContent = msg;
}

function ocultarLoading() {
  DOM.loadingModal.classList.add('hidden');
}
