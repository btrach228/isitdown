import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import fs from 'fs'
import dotenv from 'dotenv';
dotenv.config();
// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with the token you got from BotFather
const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });



// Settings for checking sites
const checkConfig = {
  timeout: 10000, // 10 seconds timeout for each request
  errorThreshold: 5, // Number of consecutive errors to trigger an alert
};

// File for storing chat IDs
const chatIdsFile = 'chatIds.json';

// Load chat IDs from file
let chatIds = loadChatIds();

// Object to keep track of error counts for each site
const errorCounts = {};

// Listen for the /start command and add chat ID to chatIds if not already there
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!chatIds.includes(chatId)) {
    chatIds.push(chatId);
    saveChatIds(chatIds); // Save chat ID to file
  }

  bot.sendMessage(chatId, 'Бот запущено! Ви будете автоматично отримувати сповіщення, якщо один або більше сайтів будуть недоступні.\n\nЯкщо бажаєте перевіти певний сайт - надішліть URL у форматі /check <url>, щоб отримати статус.');
});

// Listen for the /check command with a URL
bot.onText(/\/check (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const urlToCheck = match[1];

  checkUrlStatus(chatId, urlToCheck);
});

// Function to check the status of a specific URL
async function checkUrlStatus(chatId, url) {
  try {
    const response = await fetchWithTimeout(url, checkConfig.timeout);
    console.log(`Site: ${url}: status: ${response.status}`)
    bot.sendMessage(chatId, `Status code for ${url}: ${response.status}`);
    resetErrorCount(url); // Reset error count if the site responded
  } catch (error) {
    console.error('Error checking status:', error.message);
    incrementErrorCount(url); // Increment error count if there was no response
    bot.sendMessage(chatId, `Error checking status for ${url}: ${error.message}`);

    // Check if the error threshold has been reached
    if (errorCounts[url] >= checkConfig.errorThreshold) {
      bot.sendMessage(chatId, `Alert: ${url} has been unresponsive multiple times. Possible DDoS attack or connectivity issue.`);
      resetErrorCount(url); // Reset error count after alert
    }
  }
}

// Function to check URL status with a timeout
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw new Error("No response (timeout reached)");
  }
}

// Functions to handle error count
function incrementErrorCount(url) {
  if (!errorCounts[url]) errorCounts[url] = 0;
  errorCounts[url]++;
}

function resetErrorCount(url) {
  errorCounts[url] = 0;
}

// Function to periodically check multiple URLs for all saved chat IDs
async function checkStatuses() {
  if (chatIds.length === 0) {
    console.log('No active chats. Waiting for /start command...');
    return;
  }

  // Example URLs to monitor (modify or expand as needed)
  const urlsToCheck = [
    'https://toyota.ua',
    'https://lexus.com',
    'https://stock.lexus.ua',
    'https://almaz-motor.toyota.ua',
    'https://usedcars.toyota.ua',
    'https://usedcars.lexus.ua',
    'https://sawa.toyota.ua',
  ];

  for (const url of urlsToCheck) {
    for (const chatId of chatIds) {
      try {
        const response = await fetchWithTimeout(url, checkConfig.timeout);
        if (response.status !== 200) {
            bot.sendMessage(chatId, `Увага!: Помилка ${response.status} ${response.message} виявлено для ${url}`);
        }
        resetErrorCount(url); // Reset error count if the site responded
      } catch (error) {
        console.error(`Error checking status for ${url}:`, error.message);
        incrementErrorCount(url);

        // Check if the error threshold has been reached
        if (errorCounts[url] >= checkConfig.errorThreshold) {
          bot.sendMessage(chatId, `Увага!: ${url} не відповідає кілька разів. Можлива DDoS-атака або проблема зі з'єднанням.`);
          resetErrorCount(url); // Reset error count after alert
        }
      }
    }
  }
}

// Set an interval to check the status of all URLs every minute (adjust as needed)
setInterval(checkStatuses, 600000);

// Function to load chat IDs from file
function loadChatIds() {
  try {
    if (fs.existsSync(chatIdsFile)) {
      const data = fs.readFileSync(chatIdsFile);
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading chat IDs:', error);
    return [];
  }
}

// Function to save chat IDs to file
function saveChatIds(chatIds) {
  try {
    fs.writeFileSync(chatIdsFile, JSON.stringify(chatIds));
  } catch (error) {
    console.error('Error saving chat IDs:', error);
  }
}

