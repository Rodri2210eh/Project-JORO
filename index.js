const express = require('express');
const { auth } = require('google-auth-library');
const {google, gamesConfiguration_v1configuration} = require('googleapis');
const {bcrypt} = require('bcrypt');
const passwordValidator = require('password-validator');

const app = express();

//create client
const client = async (req, res) => {
    await auth.getClient()
};

//Instance of the googlesheets
const googleSheets = google.sheets({version: "v4", auth: client});

const spreadsheetId = "16WEvH9Kuz8YYItsAPTBNuqJx6gLNVrjVgwU_8ANmIeY";
let profeActual = [];
let datosProfesores = [];
let datosEstudiantes = [];
let index_student_modify = 0;
let actual_estud = [];
let message = "";

app.set("view engine", "ejs");

app.use(express.static(__dirname + '/public'));

app.use(express.urlencoded({extended: true}));

app.get('/', async(req, res) => {

    await actualizarInformacionProfesor();

    res.render("index", {
        message: message
    });
    message = "";
});

app.post('/', async (req, res) => {

    const {username, password} = req.body;

    if ( await verificarInformacion(username, password)) {
        res.redirect("menuPrincipal");
    }
    else {
        message = "Mal"
        res.redirect("index")
    }
});

app.get('/menuPrincipal', async(req, res) => {
    message = ""
    res.render("menuPrincipal");

});

app.get('/administrarCuentas', async(req, res) => {
    message = ""
    res.render("administrarCuentas");

});

app.get('/editAccount', async(req, res) => {
    res.render("editAccount", {
        message: message
    });
});

app.post('/editAccount', async(req, res) => {
    const {usuario} = req.body;

    await actualizarInformacionProfesor();

    const profe = await buscarProfesor(usuario);

    if (profe != []) {
        profeActual = profe;
        res.redirect("/verProfesor");
    } else {
        message = "Mal";
        res.redirect("editAccount");
    }

});

app.get('/verProfesor', async(req, res) => {
    res.render("verProfesor", {
        message: profeActual
    });
});

app.post('/verProfesor', async(req, res) => {
    try {
        message = ""
        await actualizarInformacionProfesor();

        const {name, lastname, username, password, rol} = req.body;

        // Create a schema
        var schema = new passwordValidator();

        // Add properties to it
        schema
        .is().min(8)                                    // Minimum length 8
        .is().max(100)                                  // Maximum length 100
        .has().uppercase()                              // Must have uppercase letters
        .has().lowercase()                              // Must have lowercase letters
        .has().digits(1)                                // Must have at least 2 digits
        .has().not().spaces()                           // Should not have spaces
        .is().not().oneOf(['Passw0rd', 'Password123']);

        if (schema.validate(password) !== true){
            message = "No actualizo";
            res.redirect("editAccount");

        }
        else{
            const index = await getId(profeActual[3]);
            const row = await getRowUsuario(profeActual[3]);


            if (await deleteUser(row)) {
                await actualizarInformacionProfesor();
                const auth = new google.auth.GoogleAuth({
                    keyFile: "credentials.json",
                    scopes: "https://www.googleapis.com/auth/spreadsheets"
                });
                
                await googleSheets.spreadsheets.values.append({
                        auth,
                        spreadsheetId,
                        range: "Usuarios!A:F",
                        valueInputOption: "USER_ENTERED",
                        resource: {
                            values:[
                                [index, name, lastname, username, password, rol]
                            ]
                        }
                });
                message = "200 OK";
                res.redirect("editAccount");
            } else {
                message = "No actualizo";
                res.redirect("editAccount");
            }

        }
    }
    catch {

    }
});


app.get('/deleteAccount', async(req, res) => {
    res.render("deleteAccount", {
        message: message
    });
});


app.post('/deleteAccount', async(req, res) =>{
    message=""
    const {usuario} = req.body;
    const index = await getRowUsuario(usuario);

    if (index === 0){
        message = "Mal"
        res.redirect("deleteAccount");
    }

    else if (await deleteUser(index)) {
        await actualizarInformacionProfesor();
        message = "200 OK";
        res.redirect("deleteAccount");
    } else {
        message = "Mal";
        res.redirect("deleteAccount");
    }
});

app.get('/administrarEstudiantes', async(req, res) => {
    message = ""
    res.render("administrarEstudiantes");

});


app.get('/createAccount', async (req, res) => {
    res.render("createAccount", {
        message: message
    })
});

app.post('/createAccount', async (req, res) => {

    try {
        await actualizarInformacionProfesor();

        const {name, lastname, username, password, rol} = req.body;

        var schema = new passwordValidator();

        // Add properties to it
        schema
        .is().min(8)                                    // Minimum length 8
        .is().max(100)                                  // Maximum length 100
        .has().uppercase()                              // Must have uppercase letters
        .has().lowercase()                              // Must have lowercase letters
        .has().digits(1)                                // Must have at least 2 digits
        .has().not().spaces()                           // Should not have spaces
        .is().not().oneOf(['Passw0rd', 'Password123']);

        if (schema.validate(password) !== true){
            message = "Mal pass";
            res.redirect("createAccount");
        } else{
            if ( await checkUsername(username)) {
                const auth = new google.auth.GoogleAuth({
                    keyFile: "credentials.json",
                    scopes: "https://www.googleapis.com/auth/spreadsheets"
                });
    
                const id = datosProfesores.length;
                
                await googleSheets.spreadsheets.values.append({
                        auth,
                        spreadsheetId,
                        range: "Usuarios!A:F",
                        valueInputOption: "USER_ENTERED",
                        resource: {
                            values:[
                                [Number(datosProfesores[id-1][0])+1, name, lastname, username, password, rol]
                            ]
                        }
                });
                await actualizarInformacionProfesor();
                message = "200 OK";
                res.redirect("createAccount");
            } else {
                message = "Mal";
                res.redirect("createAccount");
    
            }

        }

    }
    catch {

    }
});

app.get('/buscarInformacion', async(req, res) => {

    res.render("buscarInformacion", {
        message: message
    });

});

app.post('/buscarInformacion', async(req, res) => {
    message = "";
    const {nombre_completo, grupo, año} = req.body;

    await actualizarInformacionEstudiante(año);
    //console.log(datosEstudiantes);

    const estudiante = await searchEstudiante(nombre_completo, grupo);
    //console.log(estudiante);

    const auxiliar = await getAuxiliar();
    const profesGuias = await getProfes(año, grupo);
    //console.log(auxiliar);
    //console.log(profesGuias);

    if (estudiante.length === 0) {
        message = "Mal";
        res.redirect("buscarInformacion");
    } else {
        message = [estudiante[0], estudiante[1], estudiante[2], estudiante[3], estudiante[4], estudiante[5], estudiante[6], profesGuias[0], profesGuias[1], profesGuias[2], profesGuias[3], auxiliar[0], auxiliar[1], estudiante[7], estudiante[8]];
        //console.log(message);
        //console.log(message.length);
        res.redirect("mostrarEstudiante");
    }

});

app.get('/mostrarEstudiante', async(req, res)=>{
    res.render("mostrarEstudiante", {
        message: message
    });
});

app.get('/deleteStudent', async(req, res) => {

    res.render("deleteStudent", {
        message: message
    });
});


app.post('/deleteStudent', async(req, res) =>{
    const {nombre_completo, grupo, año} = req.body;
    await actualizarInformacionEstudiante(año);
    const index = await getRowStudent(nombre_completo, grupo);
    const datos = [grupo, "", "", "", "", "", ""];

    if (index === 0){
        message = "Mal";
        res.redirect("deleteStudent");

    } else if (await updateStudent(año, index, datos)) {
        await actualizarInformacionEstudiante(año);
        message = "200 OK";
        res.redirect("deleteStudent");
    } else {
        message = "Mal";
        res.redirect("deleteStudent");
    }
});

app.get('/addStudent', async (req, res) => {
    res.render("addStudent", {
        message: message
    })
});

app.post('/addStudent', async (req, res) => {

    try {
        message = "";
        const {nombreCompleto, nombreTutor, correoTutor, telefonoTutor, grupo, año} = req.body;

        await actualizarInformacionEstudiante(año)
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: "https://www.googleapis.com/auth/spreadsheets"
        });

        const fila = await obtenerIdProx(grupo, año);
        
        await googleSheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: año + "!B"+String(Number(fila)+1),
                valueInputOption: "USER_ENTERED",
                resource: {
                    values:[
                        [grupo, nombreCompleto, año, nombreTutor, correoTutor, telefonoTutor, "Activo", 0]
                    ]
                }
        });
        message = "200 OK";
        res.redirect("addStudent");

    }
    catch {
        message= "Mal";
        res.redirect("addStudent");
    }
});

app.get('/editStudent', async (req, res) => {
    res.render("editStudent", {
        message: message
    })
});

app.post('/editStudent', async (req, res) => {

    try {

        const {nombre_completo, grupo, año} = req.body;

        await actualizarInformacionEstudiante(año);

        //console.log(datosEstudiantes);

        index_student_modify = await getRowStudent(nombre_completo, grupo);

        const estudiante = await searchEstudiante(nombre_completo, grupo);

        //console.log(estudiante);

        actual_estud = [estudiante[0], estudiante[1], estudiante[2], estudiante[3], estudiante[4], estudiante[5], estudiante[6], estudiante[7]];
        

        if (index_student_modify !== 0){
            res.redirect("verEstudiante");
        } else{
            message = "Mal";
            res.redirect("editStudent");
        }

    }
    catch {
        message = "Mal";
        res.redirect("editStudent");
    }
});

app.get('/verEstudiante', async (req, res) => {
    res.render("verEstudiante", {
        message: actual_estud
    })
});

app.post('/verEstudiante', async (req, res) => {
    try {

        const {nombreCompleto, nombreTutor, correoTutor, telefonoTutor, grupo, año, estado} = req.body;

        await actualizarInformacionEstudiante(año);


        const data = [grupo, nombreCompleto, año, nombreTutor, correoTutor, telefonoTutor, estado];


        if (await updateStudent(año, index_student_modify, data)){
            message = "200 OK";
            res.redirect("editStudent");
        } else{
            message = "Mal";
            res.redirect("editStudent");
        }
    }
    catch {
        message = "Mal";
            res.redirect("editStudent");
    }
});

function getAuxiliar(){
    let nombre = "";
    let correo = "";
    let i = 0;
    while (i < datosEstudiantes.length){
        if (datosEstudiantes[i][0] === "Auxiliar de los séptimos:"){
            nombre = datosEstudiantes[i][1];
            correo = datosEstudiantes[i][4];
            i = datosEstudiantes.length;
        }
        i += 1;
    }
    return [nombre, correo];
}

function getProfes(año, seccion){
    let i = 0;
    let label = getLabelByLevel(año, seccion);
    let nombreOrientador = "";
    let correoOrientador = "";
    let nombreProfeGuia = "";
    let correoProfeGuia = "";
    while (i < datosEstudiantes.length){
        if (datosEstudiantes[i][0] === label){
            nombreOrientador = datosEstudiantes[i+1][1];
            correoOrientador = datosEstudiantes[i+1][4];
            nombreProfeGuia = datosEstudiantes[i+2][1];
            correoProfeGuia = datosEstudiantes[i+2][4];
            i = datosEstudiantes.length;
        }
        i += 1;
    }
    return [nombreOrientador, correoOrientador, nombreProfeGuia, correoProfeGuia];
}

function getLabelByLevel(año, seccion){
    if (año === "Septimo"){
        return "Sección 7 =>" + seccion;
    } else if (año === "Octavo"){
        return "Sección 8 =>" + seccion;
    } else if (año === "Noveno"){
        return "Sección 9 =>" + seccion;
    } else if (año === "Decimo"){
        return "Sección 10 =>" + seccion;
    } else{
        return "Sección 11 =>" + seccion;
    }
}

function obtenerIdProx(grupo, año){
    const label = getLabelByLevel(año, grupo);
    let pos = 0;
    let i = 1;
    while (i < datosEstudiantes.length){
        console.log(datosEstudiantes[i][0])
        if (datosEstudiantes[i][0] === label){
            i += 5;
            let j = i;
            while (j < datosEstudiantes.length){
                if (datosEstudiantes[j][2] === undefined || datosEstudiantes[j][2] === ""){
                    pos = j;
                    j = datosEstudiantes.length;
                }
                j += 1;
            }
            i = datosEstudiantes.length;
        }
        i += 1;
    }
    return pos;
}

function buscarProfesor(username){
    let profesor = [];
    datosProfesores.forEach(element => {
        if (element[3] == username){
            profesor = element;
        }
    });
    return profesor;
}

function getId(username){
    let idProfesor = 0;
    datosProfesores.forEach(element => {
        if (element[3] == username){
            profesor = element[0];
        }
    });
    return idProfesor;
}

async function getRowUsuario(username){
    await actualizarInformacionProfesor();
    let pos = 0;
    let i = 1;
    while (i < datosProfesores.length){
        if (datosProfesores[i][3] === username){
            pos = i;
            i = datosProfesores.length;
        }
        i ++;
    }
    return pos; 

}

async function deleteUser(index){
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: "https://www.googleapis.com/auth/spreadsheets"
        });
        
        await googleSheets.spreadsheets.batchUpdate({
            auth: auth,
            spreadsheetId: spreadsheetId,
            resource: {
            "requests": 
            [
                {
                "deleteRange": 
                {
                    "range": 
                    {
                    "sheetId": 0, // gid
                    "startRowIndex": index,
                    "endRowIndex": index+1
                    },
                    "shiftDimension": "ROWS"
                }
                }
            ]
            }
        });
        await actualizarInformacionProfesor();
        return true;
    } catch (error) {
        return false;
    }
}

async function checkUsername(username){
    
    let valor = true;
    datosProfesores.forEach(element => {
        if (element[3] === username) {
            valor = false;
        }
    });
    return valor;
}

function verificarInformacion(user, pass){
    let valor = false;
    datosProfesores.forEach(element => {
        if (user === element[3] && pass === element[4] && user !== "Usuario" && pass !== "Contraseña" && element[5] === "administrador"){
            valor = true;
        }
    });
    return valor;
}

function searchEstudiante (nombre_completo, grupo){
    let estud = [];
    datosEstudiantes.forEach(element => {
        if (nombre_completo === element[2] && grupo === element[1]) {
            estud = element;
        }
    });
    return estud;
}

async function getRowStudent(nombreCompleto, grupo){
    let pos = 0;
    let i = 1;
    while (i < datosEstudiantes.length){
        if (nombreCompleto === datosEstudiantes[i][2] && grupo === datosEstudiantes[i][1]){
            pos = i;
            i = datosEstudiantes.length;
        }
        i ++;
    }
    return pos; 
}

async function deleteStudent(index, año){
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: "https://www.googleapis.com/auth/spreadsheets"
        });

        const gid = await getIdSpreedStudent(año)
        
        await googleSheets.spreadsheets.batchUpdate({
            auth: auth,
            spreadsheetId,
            resource: {
            "requests": 
            [
                {
                "deleteRange": 
                {
                    "range": 
                    {
                    "sheetId": gid,
                    "startRowIndex": index,
                    "endRowIndex": index+1
                    },
                    "shiftDimension": "ROWS"
                }
                }
            ]
            }
        });
        return true;
    } catch (error) {
        return false;
    }
}

function getIdSpreedStudent(año){
    if (año === "Septimo"){
        return "1140561052";
    } else if (año === "Octavo"){
        return "843694816";
    } else if (año === "Noveno"){
        return "174224146"
    } else if (año === "Decimo"){
        return "485681426"
    } else{
        return "389279693"
    }
}

async function actualizarInformacionProfesor () {
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    });
    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Usuarios"
    });
    datosProfesores = getRows.data.values;
}

async function actualizarInformacionEstudiante (año) {

    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    });

    const getRowse = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: año
    });
    datosEstudiantes = getRowse.data.values;
}

async function updateStudent(año, index, data){
    try{
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: "https://www.googleapis.com/auth/spreadsheets"
        });
    
        await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: año + "!B"+ String(Number(index)+1),
            valueInputOption: "USER_ENTERED",
            resource: {
                values:[
                    data
                ]
            }
        });
        return true
    } catch (error) {
        console.log(error)
        return false
    }
}

app.listen(1337, (req, res) => console.log('Listening on port 1337'));