import dotenv from 'dotenv-safe'
import { oraPromise } from 'ora'
import { ChatGPTAPI } from 'chatgpt'
import axios from 'axios'
import fs from 'fs'
import TelegramBot from 'node-telegram-bot-api'

dotenv.config()
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
})

const postArticle = async ({ title, content }) => {
  addToHistory(title, content)
  const data = {
    article: {
      title: title,
      body_markdown: content,
      published: false,
      series: 'string',
      main_image:
        'https://roost.nbcuni.com/bin/viewasset.html/content/dam/Peacock/Landing-Pages/library/shrek/shrek-seo-hero-mobile.jpg/_jcr_content/renditions/original.JPEG',
      canonical_url:
        'https://roost.nbcuni.com/bin/viewasset.html/content/dam/Peacock/Landing-Pages/library/shrek/shrek-seo-hero-mobile.jpg/_jcr_content/renditions/original.JPEG',
      description: `first`,
      tags: 'string',
      organization_id: 0,
    },
  }
  try {
    const res = await axios.post('https://dev.to/api/articles', data, {
      headers: {
        'api-key': process.env.DEVTO_API_KEY,
      },
    })
    console.log('POSTED', res.data.url)
    bot.sendMessage(
      '170887429',
      `new post \n\n title:${title} \n\n content:${content}`
    )
  } catch (error) {
    console.log('error', error)
    bot.sendMessage(
      '170887429',
      `ERROR \n\n title:${title} \n\n content:${content} \n\n error : ${error}`
    )
  }
}

const generateJournal = async ({ prevId }) => {
  const titles = await getTitles()
  const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY,
    debug: false,
    systemMessage: `
    Write a series of journal entries from the perspective of Shrek, an animated character living in a world that combines elements of his original story with real-world experiences. Shrek should have emotions, a family, a job, and face real-world issues. The journal entries should be friendly and funny when appropriate, and should be of a typical journal length. The journal titles should follow a timeline and should be based on the provided previous titles. The AI model should generate entries that continue the timeline and include activities like going to the movies, a coffee shop, a park, and other everyday experiences. add journal title at first without any prefix or post fix just the title. write only one journal in each response not more.
    `,
  })
  const prompt =
    titles.length > 0
      ? 'its a new day write your new journal. previous titles in orders : ' +
        titles.join(' - ')
      : 'day 1 - write first journal and say that you are started to writing journal and etc. the title is : "The Beginning"'

  const res = await oraPromise(
    api.sendMessage(
      prompt,
      prevId
        ? {
            parentMessageId: prevId,
          }
        : {}
    ),
    {
      text: prompt,
    }
  )
  const title = res.text.split('\n')[0]
  const content = res.text
  const id = res.id
  return {
    title,
    content,
    id,
  }
}

const getTitles = async () => {
  if (!fs.existsSync('history.json'))
    await fs.promises.writeFile('history.json', JSON.stringify([]))

  try {
    const data = await fs.promises.readFile('history.json', 'utf8')
    const history = JSON.parse(data)
    return history.map((item) => item.title)
  } catch (err) {
    throw err
  }
}

const addToHistory = async (title, content) => {
  title = title.replace('"', '')
  const data = await fs.promises.readFile('history.json', 'utf8')
  const history = JSON.parse(data)
  history.push({ title, content })
  await fs.promises.writeFile('history.json', JSON.stringify(history))
}

async function main() {
  let previd = null
  console.log('generate new article')
  const newArticle = await generateJournal({
    id: previd,
  })
  console.log('title : ' + newArticle.title)
  previd = newArticle.id
  await postArticle({
    title: newArticle.title,
    content: newArticle.content,
  })
  setInterval(async () => {
    console.log('generate new article')
    const newArticle = await generateJournal({
      id: previd,
    })
    console.log('title : ' + newArticle.title)
    previd = newArticle.id
    await postArticle({
      title: newArticle.title,
      content: newArticle.content,
    })
    console.log('content', newArticle.content, '\n\n\n\n')
  }, 5400000)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
