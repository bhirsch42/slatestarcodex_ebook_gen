const request = require('request')
const cheerio = require('cheerio')
const _ = require('lodash')
const fs = require('fs')
const redis = require('redis').createClient()
const download = require('image-downloader')

let posts = []

requestp('http://slatestarcodex.com/archives/')
  .then(getLinksFromArchive)
  .then(traverseLinks)

function requestp(url) {
  return new Promise((resolve, reject) => {
    redis.get(JSON.stringify(url), (redisErr, data) => {
      if (redisErr) {
        reject(redisErr)
      }
      else if (data) {
        console.log(`From cache: ${url}`)
        resolve(JSON.parse(data))
      } else {
        console.log(`Fetching: ${url}`)
        request(url, (err, data) => {
          if (err) {
            reject(err)
          } else {
            redis.set(JSON.stringify(url), JSON.stringify(data), redisSetErr => {
              redisSetErr ? reject(redisSetErr) : resolve(data)
            })
          }
        })
      }
    })
  })
}

function traverseLinks(links, index=0) {
  if (index < links.length) {
    requestp(links[index])
      .then(handlePost)
      .then(postText => {
        posts[index] = postText
        fs.writeFileSync('output.html', posts.join(''))
        traverseLinks(links, index + 1)
      })
  } else {
    fs.writeFileSync('output.html', posts.join(''))
    console.log("Done!")
  }
}

function getLinksFromArchive(data) {
  let $ = cheerio.load(data.body)
  let links = $('a[rel=bookmark]').map((_i, el) => $(el).attr('href')).get()
  return _.reverse(links)
}

function handlePost(data) {
  let $ = cheerio.load(data.body)
  let post = $('.post')
  post.find('.sharedaddy').remove()
  post.find('.pjgm-postutility').remove()
  return Promise.all(post.find('img').map((_i, img) => handleImageEls($(img))).get())
    .then(() => {
      return post.html()
    })
}

function handleImageEls(imageEl) {
  let imageUrl = imageEl.attr('src')
  let filename = imageUrl.split('/').filter(s => s.match(/\.(png|gif|jpg|jpeg)/))[0]
  destPath = `./Images/${filename}`
  imageEl.attr('src', `./Images/${filename}`)

  if (filename && !fs.existsSync(destPath)) {
    download.image({url: imageUrl, dest: destPath}) // should just return this
      .catch(() => {
        console.log("Error loading image: ", imageUrl)
        return Promise.resolve()
      })
    return Promise.resolve()
  } else {
    return Promise.resolve()
  }
}