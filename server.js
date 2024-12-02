import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();
const botToken = process.env.BOT_TOKEN;

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Defining a User schema
const userSchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true },
    username: { type: String, default: null },
    name: {type: String, default: null},
    createdAt: { type: Date, default: Date.now },
  });
  
  // Creating a User model
const User = mongoose.model('User', userSchema);

// Initializing the Telegram bot
const bot = new TelegramBot(botToken, { polling: true });

// Settings for checking sites
const checkConfig = {
  timeout: 10000, // 10 seconds timeout for each request
  errorThreshold: 5, // Number of consecutive errors to trigger an alert
};

// // Object to keep track of error counts for each site
const errorCounts = {};

// Listen for the /start command and add chat ID to chatIds if not already there
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.chat.username || 'Anonymous';
  const name = msg.chat.first_name;
  try {
    // Check if the user already exists in the database
    let user = await User.findOne({ chatId });
    console.log(msg)

    if (!user) {
      // Save new user to MongoDB
      user = new User({ chatId, username, name });
      await user.save();
      bot.sendMessage(chatId, 'Бот запущено! Ви будете автоматично отримувати сповіщення, якщо один або більше сайтів будуть недоступні.\n\nЯкщо бажаєте перевіти певний сайт - надішліть URL у форматі /check <url>, щоб отримати статус.');
    } else {
        bot.sendMessage(chatId, `Бот вже запущено, ${name}! Ви будете автоматично отримувати сповіщення, якщо один або більше сайтів будуть недоступні.\n\nЯкщо бажаєте перевіти певний сайт - надішліть URL у форматі /check <url>, щоб отримати статус.`);
    }
  } catch (error) {
    console.error("Error handling /start:", error.message);
    bot.sendMessage(chatId, "Під час обробки вашого запиту сталася помилка.");
  }

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
    console.log(`Site: ${url}: status: ${response.status}`);
    if(response.status<300){
      bot.sendMessage(chatId, `Статус код для ${url}: ${response.status}. Сайт працює стабільно`);
    }else{
      bot.sendMessage(chatId, `Статус код для ${url}: ${response.status}. Перевірте роботу вашого сайту, схоже щось не так.`);
    }
    resetErrorCount(url); // Reset error count if the site responded
  } catch (error) {
    console.error('Error checking status:', error.message);
    incrementErrorCount(url); // Increment error count if there was no response
    bot.sendMessage(chatId, `Виникла помилка при перевірці статусу для ${url}: ${error.message}. Перевірте правильність написання url`);

    // Check if the error threshold has been reached
    if (errorCounts[url] >= checkConfig.errorThreshold) {
      bot.sendMessage(chatId, `Увага!: ${url} не відповідає кілька разів. Можлива DDoS-атака або проблема зі з'єднанням.`);
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


  // Example URLs to monitor (modify or expand as needed)
  const urlsToCheck = process.env.SITE_LINKS ? process.env.SITE_LINKS.split(',') : [];

  if (urlsToCheck.length === 0) {
    console.log("No URLs to monitor.");
    return;
  }


  try {
    // Get all registered users from the database
    const users = await User.find();
    if (users.length === 0) {
      console.log("No active users. Waiting for /start command...");
      return;
    }

    for (const url of urlsToCheck) {
      for (const user of users) {
        try {
          const response = await fetchWithTimeout(url, checkConfig.timeout);
          if (response.status !== 200) {
            bot.sendMessage(user.chatId, `Увага!: Помилка ${response.status} ${response.message} виявлено для ${url}`);
          }
          resetErrorCount(url);
        } catch (error) {
          console.error(`Error checking ${url} for user ${user.chatId}:`, error.message);
          incrementErrorCount(url);

          if (errorCounts[url] >= checkConfig.errorThreshold) {
            bot.sendMessage(user.chatId, `Увага!: ${url} не відповідає кілька разів. Можлива DDoS-атака або проблема зі з'єднанням.`);
            resetErrorCount(url);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error during periodic check:", error.message);
  }
}

// Set an interval to check the status of all URLs every minute (adjust as needed)
setInterval(checkStatuses, 60000);


