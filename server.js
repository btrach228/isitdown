// const TelegramBot = require('node-telegram-bot-api');
// const fetch = require('node-fetch');
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';

// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with the token you got from BotFather
const botToken = '7490015692:AAFScp1LvvU1O-CLheIJ0YoG2Stb8vjNb6I';
const bot = new TelegramBot(botToken, { polling: true });

// Array of URLs to monitor
const urlsToCheck = [
    'https://toyota.ua',
    'https://lexus.com',
    'https://almaz-motor.toyota.ua',
    'https://usedcars.toyota.ua',
    'https://usedcars.lexus.ua',
    'https://stock.lexus.ua',
    'https://sawa.toyota.ua',
    'https://sawa.toyota.ua',
  ];
  
let delayTime = 1000*60;// 1 min
  // Variable to store the dynamic chat ID
  let dynamicChatId = null;
  
  // Listen for the /start command to set up the chat ID dynamically
  bot.onText(/\/start/, (msg) => {
    dynamicChatId = msg.chat.id;
    bot.sendMessage(dynamicChatId, 'Бот запущено! Ви будете отримувати сповіщення, якщо один або більше сайтів будуть недоступні.');
  });
  
  // Function to check the status of each URL
  async function checkStatuses() {
    if (!dynamicChatId) {
      console.log('Waiting for /start command to set chat ID...');
      return;
    }
  
    for (const url of urlsToCheck) {
      try {
        const response = await fetch(url);
        if (response.status !== 200) {
            // delayTime=1000//300000
          bot.sendMessage(dynamicChatId, `УВАГА САЙТ НЕ ДОСТУПНИЙ:\n Виявлено для:${url}\n Статус код: ${response.status} ${response.statusText}`);
        //   if(response.status == 200){
        //     bot.sendMessage(dynamicChatId, `Доступ ${url} до відновлено`);
        //     delayTime=5000//3600000
        //   }
        } else {
          console.log(`Status code for ${url}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error checking status for ${url}:`, error);
      }
    }
  }
  
  // Set an interval to check the statuses of all URLs every minute (or adjust as needed)
  setInterval(checkStatuses, delayTime);
