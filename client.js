const crypto = require('crypto')
const inquirer = require('inquirer')
const NodeRSA = require('node-rsa');
const fs = require('fs')
const jwt = require('jwt-simple')
const { connect } = require('simple-socket-session')
var cert = fs.readFileSync('my-cerf.pem')
connect('http://localhost', session)

const pubPem = fs.readFileSync('pub.pem')
const publicRSAKey = new NodeRSA()
publicRSAKey.importKey(pubPem,'pkcs8-public')

async function readInput(request) {
  if (request === 'register' || request === 'signup') {
    return await inquirer.prompt([
      { name: 'email', message: 'Email:' },
      { name: 'password', type: 'password', message: 'Password:' }
    ])
  } else if (request === 'login') {
    return await inquirer.prompt([
      { name: 'email', message: 'Email:' },
      { name: 'password', type: 'password', message: 'Password:' }
    ])
  } else {
    return null
  }
}

function rsaEncrypt(data) {
  var dataEn = publicRSAKey.encrypt(data,'base64')
  return Buffer.from(dataEn, 'base64')
}

function generateIv() {
  return crypto.randomBytes(8)
}

function generateKey() {
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
    iv: iv.toString('base64'), // base64 te serveri
    key: rsaEncrypt(key).toString('base64'), // base64 te serveri
    data: desEncrypt(iv, key, data) // base64 te serveri
  }
}

function decrypt(key, encrypted) {
  const {
    iv, // base64 nga serveri
    data // base64 nga serveri
  } = encrypted

  return desDecrypt(Buffer.from(iv, 'base64'), key, Buffer.from(data, 'base64'))
}

async function session(send, receive) {
  const request = (process.argv[2] || '').toLowerCase()
  const input = await readInput(request) // lexojme inputs
  if (!input) {
    console.log('No request given.')
    return
  } 
  if(request === 'login'){
    input.type = request
  
  const key = generateKey()
  await send('request', encrypt(key, input)) // ja dergojme input server, todo encrypt
  const response = await receive('response') // pranojme pergjigje nga serveri, todo decrypt
  const decryptedResponse = decrypt(key, response)
  var verified = jwt.decode(decryptedResponse,cert)
  console.log('Pergjigja nga serveri: ', verified)
  
  }else{
    input.type = request

    const key = generateKey()
  await send('request', encrypt(key, input)) // ja dergojme input server, todo encrypt
  const response = await receive('response') // pranojme pergjigje nga serveri, todo decrypt
  const decryptedResponse = decrypt(key, response)
  console.log('Pergjigja nga serveri: ', decryptedResponse)
  }

  
}