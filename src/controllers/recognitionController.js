const express = require('express');
const router = express.Router();
const db = require('../database/mysql');
const fs = require('fs');
const path = require('path').join(__dirname, '..', '/img/');
const faceRecognition = require('../recognition/initFace');
const plateRecognition = require('../recognition/initPlate');

const baseURL = 'http://localhost:3333/recognition/profileImage/';

function weekDay() {
  var d = new Date();
  var weekday = new Array(7);
  weekday[0] = 'dom';
  weekday[1] = 'seg';
  weekday[2] = 'ter';
  weekday[3] = 'qua';
  weekday[4] = 'qui';
  weekday[5] = 'sex';
  weekday[6] = 'sab';

  return weekday[d.getDay()];
}

function isToday(someDate) {
  const today = new Date()
  return someDate.getDate() == today.getDate() &&
    someDate.getMonth() == today.getMonth() &&
    someDate.getFullYear() == today.getFullYear()
}

async function checkMoradorFace(image) {

  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM moradores WHERE img_name = ?',
    [image],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          resolve({
            imageName: baseURL + image,
            name: result[0].name,
            type: 'Morador',
            number: result[0].number,
            allowed: 'Sim'
          });
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function checkMoradorPlate(plate) {
  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM moradores WHERE plate = ?',
    [plate],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          resolve({
            imageName: baseURL + result[0].img_name,
            name: result[0].name,
            type: 'Morador',
            number: result[0].number,
            plate: result[0].plate,
            allowed: 'Sim'
          });
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function checkVisitanteFace(image) {

  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM visitantes WHERE img_name = ?',
    [image],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          resolve({
            uid: result[0].uid,
            imageName: image, name: result[0].name,
            type: 'Visitante',
            number: result[0].number
          });
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function checkVisitantePlate(plate) {

  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM visitantes WHERE plate = ?',
    [plate],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          resolve({
            uid: result[0].uid,
            imageName: baseURL + result[0].img_name,
            name: result[0].name,
            type: 'Visitante',
            number: result[0].number,
            plate: result[0].plate
          });
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function checkVisita(uid) {
  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM visitas WHERE visitantes_uid = ?',
    [uid],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          if(result[0][weekDay()] === 1)
            resolve(true);
          else {
            if(result[0].date !== null) {
              resolve(isToday(result[0].date));
            }
            else {
              resolve(false);
            }
          }
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function checkReserva(visitante_uid, dateTime) {

  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM reserva_ambientes WHERE date = ?',
    [dateTime],
    async (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          for(var i = 0; i < result.length; i++) {
            var insideList = await checkLista(result[i].lista_uid, visitante_uid);
            if(insideList === true) {
              const ambienteName = await getAmbienteName(result[i].ambiente_uid);
              resolve(ambienteName);
            }
          }
          resolve(false);
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function checkLista(lista_uid, visitante_uid) {

  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM listas WHERE uid = ?',
    [lista_uid],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        if(result.length > 0) {
          for(var i = 0; i < result.length; i++) {
            var array = result[i].ids.split(',');
            for(var j = 0; j < array.length; j++) {
              if(array[j] == visitante_uid) {
                resolve(true);
              }
            }
          }
          resolve(false);
        }
        else {
          resolve(false);
        }
      }
    });
  });

  return result;
}

async function getAmbienteName(uid) {

  const result = await new Promise((resolve, reject) => {
    db.query('SELECT * FROM ambientes WHERE uid = ?',
    [uid],
    (err, result) => {
      if(err)
        reject({ error: err });
      else {
        resolve(result[0].name);
      }
    });
  });

  return result;
}

router.post('/face', (req, res) => {

  const face = req.body.face;

  faceRecognition.stdin.write(`{"face": "${face}", "new": "${false}", "delete": "${false}"}\n`);
  faceRecognition.stdin.pause();

  faceRecognition.stdout.once('data', async (data) => {
    const image = data.toString().slice(0, -1);
    const morador = await checkMoradorFace(image);
    if(morador !== false) {
      return res.send(morador);
    }
    else {
      const visitante = await checkVisitanteFace(image);
      if(visitante !== false) {
        const visita = await checkVisita(visitante.uid);
        if(visita === false) {
          var currentDate = new Date();
          var dateTime = currentDate.getFullYear() + '-'
          + ((currentDate.getMonth() + 1) < 10 ? '0' + (currentDate.getMonth() + 1) : (currentDate.getMonth() + 1))
          + '-' + (currentDate.getDate() < 10 ? '0' + currentDate.getDate() : currentDate.getDate());
          const reserva = await checkReserva(visitante.uid, dateTime);
          if(reserva !== false) {
            return res.send({
              imageName: baseURL + visitante.imageName,
              type: visitante.type,
              name: visitante.name,
              number: visitante.number,
              allowed: reserva
            });
          }
          else {
            return res.send({
              imageName: baseURL + visitante.imageName,
              type: visitante.type,
              name: visitante.name,
              number: visitante.number,
              allowed: 'Não'
            });
          }
        }
        else {
          return res.send({
            imageName: baseURL + visitante.imageName,
            type: visitante.type,
            name: visitante.name,
            number: visitante.number,
            allowed: 'Sim'
          });
        }
      }
    }
  });
});

router.post('/plate', (req, res) => {
  const plate = req.body.plate;

  plateRecognition.stdin.write(`{"plate": "${plate}"}\n`);
  plateRecognition.stdin.pause();

  plateRecognition.stdout.once('data', async (data) => {
    const plateImage = data.toString().slice(0, -1);
    const morador = await checkMoradorPlate(plateImage);
    if(morador !== false) {
      return res.send(morador);
    }
    else {
      const visitante = await checkVisitantePlate(plateImage);
      if(visitante !== false) {
        const visita = await checkVisita(visitante.uid);
        if(visita === false) {
          var currentDate = new Date();
          var dateTime = currentDate.getFullYear() + '-'
          + ((currentDate.getMonth() + 1) < 10 ? '0' + (currentDate.getMonth() + 1) : (currentDate.getMonth() + 1))
          + '-' + (currentDate.getDate() < 10 ? '0' + currentDate.getDate() : currentDate.getDate());
          const reserva = await checkReserva(visitante.uid, dateTime);
          if(reserva !== false) {
            return res.send({
              imageName: baseURL + visitante.imageName,
              type: visitante.type,
              name: visitante.name,
              number: visitante.number,
              plate: visitante.plate,
              allowed: reserva
            });
          }
          else {
            return res.send({
              imageName: baseURL + visitante.imageName,
              type: visitante.type,
              name: visitante.name,
              number: visitante.number,
              plate: visitante.plate,
              allowed: 'Não'
            });
          }
        }
        else {
          return res.send({
            imageName: baseURL + visitante.imageName,
            type: visitante.type,
            name: visitante.name,
            number: visitante.number,
            plate: visitante.plate,
            allowed: 'Sim'
          });
        }
      }
    }
  });
});

router.get('/profileImage/:imgName', (req, res) => {

  try {
    if (fs.existsSync(path + req.params.imgName)) {

      return res.sendFile(path + req.params.imgName);
    }
  } catch(err) {

    return res.status(400).send({ error: err });
  }
});

module.exports = app => app.use('/recognition', router);