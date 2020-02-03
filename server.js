const crypto = require('crypto')
const mysql = require('mysql')
const jwt = require('jwt-simple')
const fs = require('fs')
const NodeRsa = require('node-rsa')
const { listen } = require('simple-socket-session')
listen(session)

var cert = fs.readFileSync("my-cerf.pem",'utf8')

const privPem = fs.readFileSync('key.pem')
const privateRSAKey = new NodeRsa()
privateRSAKey.importKey(privPem,'pkcs8-private')

function rsaDecrypt(data) {
  var dataEn = privateRSAKey.decrypt(data,'base64')
  return Buffer.from(dataEn, 'base64')
}

function generateIv() {
  return crypto.randomBytes(8)
}

function desDecrypt(iv, key, data) {
  const decipher = crypto.createDecipheriv('des-cbc', key, iv)
  decipher.setAutoPadding(true)
  let stringData = decipher.update(data, 'base64', 'utf8')
  stringData += decipher.final('utf8')
  console.log('Trying to decode', stringData)
  return JSON.parse(stringData)
}

function desEncrypt(iv, key, data) {
  const stringData = JSON.stringify(data)
  var encipher = crypto.createCipheriv('des-cbc', key, iv)
  const ciphertext = Buffer.concat([
    encipher.update(stringData, 'utf8'),
    encipher.final()
  ])

  return ciphertext.toString('base64')
}

function decrypt(encrypted) {
  const {
    iv, // base64 nga klienti
    key, // base64 nga klienti
    data // base64 nga klienti
  } = encrypted

  const plainKey = rsaDecrypt(Buffer.from(key, 'base64'))
  const plainData = desDecrypt(Buffer.from(iv, 'base64'), plainKey, Buffer.from(data, 'base64'))
  return [plainKey, plainData]
}

function encrypt(key, data) {
  const iv = generateIv()
  return {
    iv: iv.toString('base64'), // base64 te klienti
    data: desEncrypt(iv, key, data) // base64 te klienti
  }
}




var token = { }
var passwordDbH = ''
var user = ''
var id = ''

async function session(send, receive) {
  const [key, request] = decrypt(await receive('request')) // e marrim key dhe request nga klienti
  console.log('U pranua kerkesa', request)
 
  if (request.type === 'login') {
    
    var con = mysql.createConnection({
      host:'localhost',
      user:'root',
      password:'root',
      database:'db'
  })
  con.query("select * from users where username='"+request.email+"'",function(error,rows){
    if(error){
      console.log('error in the query')
    }
    rows.forEach(function(result){
     
      id = result.id
      user = result.username
      passwordDbH = result.password
    })
    if (user.length == 0){
      console.log(request.email + ' ka probleme gjate login')
    }else{
        var passArr = passwordDbH.split(",")
        const hash = crypto.pbkdf2Sync(
        request.password,
        passArr[0],
        parseInt(passArr[1]), 32, 'sha1').toString('hex')

        if (hash !== passArr[2]) {
          console.log(request.email + ' ka probleme gjate login')
        }else{
          console.log(request.email + ' u logua me sukses')
          token = jwt.encode({
            Id : id,
            User : user
          } ,cert)
          
        }
    }
  }) 
  con.end()
  token = jwt.encode({
    Id : id,
    User : user
  } ,cert)
  await send('response', encrypt(key,token))// e dergojme response me te njejtin celes
 
  } else if (request.type === 'register' || request.type === 'signup') {
  var con = mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'root',
    database:'db'
  })
  const salt = crypto.randomBytes(16).toString('hex')
  const iterations = 1000
  const hash = crypto.pbkdf2Sync(request.password, salt, iterations, 32, 'sha1').toString('hex')
  const passwordDb = salt+","+iterations+","+hash
  var regjistrimi = "insert into users (username, password) values ('"+request.email+"','"+passwordDb+"')"
  con.query(regjistrimi)
  con.end()
  await send('response', encrypt(key, 'U regjistruat me sukses!' )) // e dergojme response me te njejtin celes

  }
}