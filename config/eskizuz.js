const axios = require("axios");

// Eskiz SMS API конфигурация
const ESKIZ_BASE_URL =
  process.env.ESKIZ_BASE_URL || "https://notify.eskiz.uz/api";
const ESKIZ_EMAIL = process.env.ESKIZ_EMAIL;
const ESKIZ_PASSWORD = process.env.ESKIZ_PASSWORD;
const ESKIZ_FROM = process.env.ESKIZ_FROM || "4546";

if (!ESKIZ_EMAIL) {
  console.warn("ESKIZ_EMAIL не установлен в переменных окружения");
}

if (!ESKIZ_PASSWORD) {
  console.warn("ESKIZ_PASSWORD не установлен в переменных окружения");
}

// Хранение токена в памяти (в продакшене лучше использовать Redis или базу данных)
let authToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTU3NDU5NDUsImlhdCI6MTc1MzE1Mzk0NSwicm9sZSI6InRlc3QiLCJzaWduIjoiOTY0ZTZhY2I4OWFjOWMwMTk2ZjBjMGE2ZDczMjhkYmEwYmJjZGQwNzBmOTUyZGZjZWUxNmE0NmZiN2I5NTBmMiIsInN1YiI6IjEwNzU2In0.qQYGSrlu1Ak2DBIjWiUU6pC0mCjC9w8MuAU6a8zILzM`;
let tokenExpiry = null;

/**
 * Авторизация в Eskiz SMS API
 * @returns {Promise<string>} Токен авторизации
 */
async function authenticateEskiz() {
  try {
    if (!ESKIZ_EMAIL || !ESKIZ_PASSWORD) {
      throw new Error(
        "Eskiz email и password должны быть установлены в переменных окружения"
      );
    }

    const FormData = require("form-data");
    const data = new FormData();
    data.append("email", ESKIZ_EMAIL);
    data.append("password", ESKIZ_PASSWORD);

    const response = await axios.post(`${ESKIZ_BASE_URL}/auth/login`, data, {
      headers: {
        ...data.getHeaders(),
      },
      timeout: 30000,
    });

    if (response.data.message === "token_generated") {
      authToken = response.data.data.token;
      // Токен действителен 30 дней, но будем обновлять каждые 25 дней для безопасности
      tokenExpiry = Date.now() + 25 * 24 * 60 * 60 * 1000;

      console.log("Eskiz SMS: Успешная авторизация");
      return authToken;
    } else {
      throw new Error(
        `Ошибка авторизации: ${response.data.message || "Неизвестная ошибка"}`
      );
    }
  } catch (error) {
    console.error("Ошибка авторизации в Eskiz:", error.message);
    if (error.response) {
      console.error(
        "Ответ сервера:",
        error.response.status,
        error.response.data
      );
    }
    throw error;
  }
}

/**
 * Получает действующий токен (авторизуется при необходимости)
 * @returns {Promise<string>} Действующий токен
 */
async function getValidToken() {
  // Проверяем, есть ли действующий токен
  if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
    return authToken;
  }

  // Если токена нет или он истек, авторизуемся заново
  return await authenticateEskiz();
}

/**
 * Отправляет SMS через Eskiz API
 * @param {string} phoneNumber - Номер телефона в формате 998XXXXXXXXX
 * @param {string} message - Текст сообщения
 * @param {string} from - Отправитель (опционально)
 * @returns {Promise<Object>} Результат отправки
 */
async function sendSMS(phoneNumber, message, from = ESKIZ_FROM) {
  try {
    const token = await getValidToken();

    // Валидация номера телефона
    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw new Error("Номер телефона должен быть строкой");
    }

    // Убираем все символы кроме цифр
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    // Проверяем формат узбекского номера
    if (!cleanPhone.startsWith("998") || cleanPhone.length !== 12) {
      throw new Error("Номер телефона должен быть в формате 998XXXXXXXXX");
    }

    // Валидация сообщения
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      throw new Error("Сообщение не может быть пустым");
    }

    if (message.length > 918) {
      throw new Error("Сообщение слишком длинное (максимум 918 символов)");
    }

    const FormData = require("form-data");
    const data = new FormData();
    data.append("mobile_phone", cleanPhone);
    data.append("message", message.trim());
    data.append("from", from);

    const response = await axios.post(
      `${ESKIZ_BASE_URL}/message/sms/send`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...data.getHeaders(),
        },
        timeout: 30000,
      }
    );

    if (
      response.data.message === "Waiting for SMS" ||
      response.data.message === "Waiting for SMS provider"
    ) {
      return {
        success: true,
        message_id: response.data.id,
        status: response.data.status || "waiting",
        phone: cleanPhone,
        message: message.trim(),
        cost: response.data.cost || null,
        parts: response.data.parts || 1,
      };
    } else {
      throw new Error(
        `Ошибка отправки SMS: ${response.data.message || "Неизвестная ошибка"}`
      );
    }
  } catch (error) {
    console.error("Ошибка отправки SMS через Eskiz:", error.message);
    if (error.response) {
      console.error(
        "Ответ сервера:",
        error.response.status,
        error.response.data
      );

      // Если токен истек, сбрасываем его
      if (error.response.status === 401) {
        authToken = null;
        tokenExpiry = null;
        throw new Error("Токен авторизации истек. Попробуйте еще раз.");
      }
    }
    throw error;
  }
}

/**
 * Отправляет множественные SMS
 * @param {Array} recipients - Массив объектов {phone, message} или {phone, message, from}
 * @returns {Promise<Array>} Массив результатов отправки
 */
async function sendMultipleSMS(recipients) {
  try {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error(
        "Получатели должны быть переданы в виде непустого массива"
      );
    }

    const results = [];

    // Отправляем SMS последовательно, чтобы не перегружать API
    for (const recipient of recipients) {
      try {
        const result = await sendSMS(
          recipient.phone,
          recipient.message,
          recipient.from
        );
        results.push({
          phone: recipient.phone,
          success: true,
          result: result,
        });
      } catch (error) {
        results.push({
          phone: recipient.phone,
          success: false,
          error: error.message,
        });
      }

      // Небольшая задержка между отправками
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  } catch (error) {
    console.error("Ошибка массовой отправки SMS:", error.message);
    throw error;
  }
}

/**
 * Проверяет статус SMS по ID
 * @param {string} messageId - ID сообщения
 * @returns {Promise<Object>} Статус сообщения
 */
async function getSMSStatus(messageId) {
  try {
    const token = await getValidToken();

    const response = await axios.get(
      `${ESKIZ_BASE_URL}/message/sms/status_by_id/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    if (response.data.status === "success" && response.data.data) {
      return {
        message_id: messageId,
        status: response.data.data.status,
        parts: response.data.data.parts || null,
        smsc_data: response.data.data.smsc_data || null,
        created_at: response.data.data.created_at || null,
        sent_at: response.data.data.sent_at || null,
        delivery_sm_at: response.data.data.delivery_sm_at || null,
      };
    } else {
      return {
        message_id: messageId,
        status: response.data.status,
        status_note: response.data.status_note || null,
        created_at: response.data.created_at || null,
        updated_at: response.data.updated_at || null,
      };
    }
  } catch (error) {
    console.error("Ошибка получения статуса SMS:", error.message);
    throw error;
  }
}

/**
 * Получает баланс аккаунта Eskiz
 * @returns {Promise<Object>} Информация о балансе
 */
async function getBalance() {
  try {
    const token = await getValidToken();

    const response = await axios.get(`${ESKIZ_BASE_URL}/user/get-limit`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });

    return {
      balance: response.data.balance || 0,
      currency: response.data.currency || "UZS",
      is_active: response.data.is_active || false,
    };
  } catch (error) {
    console.error("Ошибка получения баланса:", error.message);
    throw error;
  }
}

/**
 * Получает информацию о пользователе
 * @returns {Promise<Object>} Информация о пользователе
 */
async function getUserInfo() {
  try {
    const token = await getValidToken();

    const response = await axios.get(`${ESKIZ_BASE_URL}/auth/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });

    return {
      id: response.data.data.id,
      name: response.data.data.name,
      email: response.data.data.email,
      role: response.data.data.role,
      status: response.data.data.status,
      balance: response.data.data.balance,
      created_at: response.data.data.created_at,
      updated_at: response.data.data.updated_at,
    };
  } catch (error) {
    console.error("Ошибка получения информации о пользователе:", error.message);
    throw error;
  }
}

/**
 * Создает шаблон SMS
 * @param {string} template - Текст шаблона
 * @returns {Promise<Object>} Результат создания шаблона
 */
async function createTemplate(template) {
  try {
    const token = await getValidToken();

    if (
      !template ||
      typeof template !== "string" ||
      template.trim().length === 0
    ) {
      throw new Error("Текст шаблона не может быть пустым");
    }

    const FormData = require("form-data");
    const data = new FormData();
    data.append("template", template.trim());

    const response = await axios.post(`${ESKIZ_BASE_URL}/user/template`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...data.getHeaders(),
      },
      timeout: 30000,
    });

    return {
      template: response.data.template,
    };
  } catch (error) {
    console.log("Ошибка создания шаблона:", error.message);
    throw error;
  }
}

/**
 * Получает список шаблонов
 * @returns {Promise<Object>} Список шаблонов
 */
async function getTemplates() {
  try {
    const token = await getValidToken();

    const response = await axios.get(`${ESKIZ_BASE_URL}/user/templates`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });

    return {
      success: response.data.success || true,
      templates: response.data.data || response.data.result || [],
    };
  } catch (error) {
    console.error("Ошибка получения шаблонов:", error.message);
    throw error;
  }
}

/**
 * Получает шаблон по ID
 * @param {string} templateId - ID шаблона
 * @returns {Promise<Object>} Данные шаблона
 */
async function getTemplateById(templateId) {
  try {
    const token = await getValidToken();

    if (!templateId) {
      throw new Error("ID шаблона обязателен");
    }

    const response = await axios.get(
      `${ESKIZ_BASE_URL}/user/template/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    return {
      success: true,
      template: response.data,
    };
  } catch (error) {
    console.error("Ошибка получения шаблона по ID:", error.message);

    if (error.response) {
      throw new Error(
        `Eskiz API error: ${error.response.status} - ${
          error.response.data?.message || error.message
        }`
      );
    }
    throw error;
  }
}

/**
 * Отправляет SMS с callback URL
 * @param {string} phoneNumber - Номер телефона в формате 998XXXXXXXXX
 * @param {string} message - Текст сообщения
 * @param {string} from - Отправитель (опционально)
 * @param {string} callbackUrl - URL для callback (опционально)
 * @returns {Promise<Object>} Результат отправки
 */
async function sendSMSWithCallback(
  phoneNumber,
  message,
  from = ESKIZ_FROM,
  callbackUrl = null
) {
  try {
    const token = await getValidToken();

    // Валидация номера телефона
    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw new Error("Номер телефона должен быть строкой");
    }

    // Убираем все символы кроме цифр
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    // Проверяем формат узбекского номера
    if (!cleanPhone.startsWith("998") || cleanPhone.length !== 12) {
      throw new Error("Номер телефона должен быть в формате 998XXXXXXXXX");
    }

    // Валидация сообщения
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      throw new Error("Сообщение не может быть пустым");
    }

    if (message.length > 918) {
      throw new Error("Сообщение слишком длинное (максимум 918 символов)");
    }

    const FormData = require("form-data");
    const data = new FormData();
    data.append("mobile_phone", cleanPhone);
    data.append("message", message.trim());
    data.append("from", from);
    if (callbackUrl) {
      data.append("callback_url", callbackUrl);
    }

    const response = await axios.post(
      `${ESKIZ_BASE_URL}/message/sms/send`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...data.getHeaders(),
        },
        timeout: 30000,
      }
    );

    if (
      response.data.message === "Waiting for SMS" ||
      response.data.message === "Waiting for SMS provider"
    ) {
      return {
        success: true,
        message_id: response.data.id,
        status: response.data.status || "waiting",
        phone: cleanPhone,
        message: message.trim(),
        cost: response.data.cost || null,
        parts: response.data.parts || 1,
        callback_url: callbackUrl,
      };
    } else {
      throw new Error(
        `Ошибка отправки SMS: ${response.data.message || "Неизвестная ошибка"}`
      );
    }
  } catch (error) {
    console.error("Ошибка отправки SMS через Eskiz:", error.message);
    if (error.response) {
      console.error(
        "Ответ сервера:",
        error.response.status,
        error.response.data
      );

      // Если токен истек, сбрасываем его
      if (error.response.status === 401) {
        authToken = null;
        tokenExpiry = null;
        throw new Error("Токен авторизации истек. Попробуйте еще раз.");
      }
    }
    throw error;
  }
}

/**
 * Получает итоги отправленных SMS по году/месяцу
 * @param {number} year - Год
 * @param {number} month - Месяц (опционально)
 * @param {boolean} isGlobal - Международные SMS (опционально)
 * @returns {Promise<Object>} Итоги SMS
 */
async function getSMSTotals(year, month = null, isGlobal = false) {
  try {
    const token = await getValidToken();

    const qs = require("qs");
    const data = {
      year: year.toString(),
      is_global: isGlobal ? "1" : "0",
    };

    if (month) {
      data.month = month.toString();
    }

    const response = await axios.post(
      `${ESKIZ_BASE_URL}/user/totals`,
      qs.stringify(data),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 30000,
      }
    );

    return {
      status: response.data.status,
      data: response.data.data || [],
      year: year,
      month: month,
      isGlobal: isGlobal,
    };
  } catch (error) {
    console.error("Ошибка получения итогов SMS:", error.message);
    throw error;
  }
}

/**
 * Получает расходы по датам
 * @param {string} startDate - Начальная дата (YYYY-MM-DD HH:MM)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD HH:MM)
 * @param {string} status - Статус SMS (опционально: '', 'delivered', 'rejected')
 * @param {string} isAd - Тип SMS (опционально: '', '1', '0')
 * @returns {Promise<Object>} Расходы по датам
 */
async function getTotalsByRange(startDate, endDate, status = "", isAd = "") {
  try {
    const token = await getValidToken();

    const FormData = require("form-data");
    const data = new FormData();
    data.append("start_date", startDate);
    data.append("to_date", endDate);
    data.append("is_ad", isAd);

    let url = `${ESKIZ_BASE_URL}/report/total-by-range`;
    if (status) {
      url += `?status=${status}`;
    }

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...data.getHeaders(),
      },
      timeout: 30000,
    });

    return {
      status: response.data.status || "success",
      data: response.data.data || response.data,
      startDate: startDate,
      endDate: endDate,
      filterStatus: status,
      filterIsAd: isAd,
    };
  } catch (error) {
    console.error("Ошибка получения расходов по датам:", error.message);
    throw error;
  }
}

/**
 * Получает расходы по рассылке
 * @param {string} dispatchId - ID рассылки
 * @param {string} status - Статус SMS (опционально: '', 'delivered', 'rejected')
 * @param {string} isAd - Тип SMS (опционально: '', '1', '0')
 * @returns {Promise<Object>} Расходы по рассылке
 */
async function getTotalsByDispatch(dispatchId, status = "", isAd = "") {
  try {
    const token = await getValidToken();

    const FormData = require("form-data");
    const data = new FormData();
    data.append("dispatch_id", dispatchId);
    data.append("is_ad", isAd);

    let url = `${ESKIZ_BASE_URL}/report/total-by-dispatch`;
    if (status) {
      url += `?status=${status}`;
    }

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...data.getHeaders(),
      },
      timeout: 30000,
    });

    return {
      status: response.data.status || "success",
      data: response.data.data || response.data,
      dispatchId: dispatchId,
      filterStatus: status,
      filterIsAd: isAd,
    };
  } catch (error) {
    console.error("Ошибка получения расходов по рассылке:", error.message);
    throw error;
  }
}

async function testConnection() {
  try {
    await getBalance();
    return true;
  } catch (error) {
    console.error("Eskiz SMS: Ошибка соединения:", error.message);
    return false;
  }
}

/**
 * Генерирует случайный код для SMS-верификации
 * @param {number} length - Длина кода (по умолчанию 6)
 * @returns {string} Сгенерированный код
 */
function generateVerificationCode(length = 6) {
  const chars = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Проверяет SMS сообщение на черный список, части и стоимость
 * @param {string} message - Текст SMS сообщения
 * @returns {Promise<Object>} Результат проверки
 */
async function checkSMSMessage(message) {
  try {
    if (!message || typeof message !== "string") {
      throw new Error("Сообщение обязательно для проверки");
    }

    const token = await getValidToken();

    const response = await axios.post(
      `${ESKIZ_BASE_URL}/message/sms/check`,
      {
        message: message,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data) {
      return {
        success: true,
        data: response.data,
        message: "SMS проверка выполнена успешно",
      };
    } else {
      throw new Error("Неверный ответ от API");
    }
  } catch (error) {
    console.error("Ошибка проверки SMS:", error.message);

    if (error.response) {
      throw new Error(
        `Eskiz API error: ${error.response.status} - ${
          error.response.data?.message || error.message
        }`
      );
    }
    throw error;
  }
}

/**
 * Отправляет SMS с кодом верификации
 * @param {string} phoneNumber - Номер телефона
 * @param {string} code - Код верификации (опционально, генерируется автоматически)
 * @param {string} appName - Название приложения (опционально)
 * @returns {Promise<Object>} Результат отправки с кодом
 */
async function sendVerificationSMS(
  phoneNumber,
  code = null,
  appName = "Sklad"
) {
  try {
    const verificationCode = code || generateVerificationCode();
    const message = `${appName} tasdiqlash kodi: ${verificationCode}\n\nBu kodni hech kimga bermang!`;

    const result = await sendSMS(phoneNumber, message);

    return {
      ...result,
      verification_code: verificationCode,
    };
  } catch (error) {
    console.error("Ошибка отправки SMS верификации:", error.message);
    throw error;
  }
}

module.exports = {
  authenticateEskiz,
  getValidToken,
  sendSMS,
  sendSMSWithCallback,
  sendMultipleSMS,
  getSMSStatus,
  getBalance,
  testConnection,
  getUserInfo,
  createTemplate,
  getTemplates,
  getTemplateById,
  getSMSTotals,
  getTotalsByRange,
  getTotalsByDispatch,
  generateVerificationCode,
  sendVerificationSMS,
  checkSMSMessage,
};
