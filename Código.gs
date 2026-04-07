function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    let result;
    if (action === 'login') result = loginUser(request.user, request.pass);
    else if (action === 'getData') result = { success: true, data: getTableData(request.rol) };
    else if (action === 'update') result = updateRecord(request.newData, request.rol, request.isNew);
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function loginUser(user, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Usuarios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === user.trim() && data[i][1].toString() === pass.toString()) {
      return { success: true, rol: data[i][2].toString().toUpperCase(), nombre: user };
    }
  }
  return { success: false, message: "Usuario o clave incorrectos" };
}

function getTableData(rol) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BD_Plantillas");
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const body = values.slice(1);

  if (rol === "SOPORTE") {
    return [headers, ...body.reverse()];
  }

  const marcaAsignada = rol.replace("OSE_", "").toUpperCase();
  const filtered = body.filter(row => row[2].toString().toUpperCase() === marcaAsignada).reverse();
  
  return [headers, ...filtered];
}

function updateRecord(newData, userRol, isNew) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BD_Plantillas");
  const now = Utilities.formatDate(new Date(), "GMT-5", "dd/MM/yyyy HH:mm:ss");
  const rol = userRol.toUpperCase();
  let rowIndexReal;
  let finalData;

  if (isNew) {
    rowIndexReal = sheet.getLastRow() + 1;
    const marca = rol.replace("OSE_", "");
    const allData = sheet.getDataRange().getValues();
    const count = allData.filter(r => r[2].toString().toUpperCase() === marca).length + 1;
    
    finalData = Array(12).fill("");
    finalData[0] = marca + "_" + (count < 10 ? "0" + count : count);
    finalData[1] = now;
    finalData[2] = marca;
    finalData[3] = newData[3]; 
    finalData[4] = newData[4]; 
    finalData[5] = newData[5]; 
    finalData[7] = newData[7]; 
    finalData[9] = "Pendiente";
  } else {
    const idBusqueda = newData[0];
    const allRows = sheet.getDataRange().getValues();
    rowIndexReal = allRows.findIndex(r => r[0].toString() === idBusqueda.toString()) + 1;
    
    if (rowIndexReal === 0) return { success: false, message: "ID no encontrado" };
    
    // Obtenemos los datos actuales de la fila antes de modificar nada
    finalData = [...allRows[rowIndexReal - 1]];
    const estadoAnterior = finalData[9]; // <--- GUARDAMOS EL ESTADO ANTERIOR AQUÍ

    if (rol.startsWith("OSE_")) {
      [3, 4, 5, 7].forEach(i => finalData[i] = newData[i]);
    } else if (rol === "SOPORTE") {
      // Soporte modifica sus campos
      [2, 3, 4, 5, 6, 7, 8, 9, 11].forEach(i => finalData[i] = newData[i]);
      
      // LÓGICA DE FECHA DE CREACIÓN:
      // Comparamos el estado que viene del formulario (newData[9]) con el que estaba en el Sheets (estadoAnterior)
      if (newData[9] === "Completado" && estadoAnterior !== "Completado") {
        finalData[10] = now;
      }
    }
  }

  sheet.getRange(rowIndexReal, 1, 1, 12).setValues([finalData]);
  return { success: true };
}