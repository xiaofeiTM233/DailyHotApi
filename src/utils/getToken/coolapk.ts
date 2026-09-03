import md5 from "md5";
import crypto from "crypto";

/**
 * 获取随机的DEVICE_ID
 * @returns DEVICE_ID
 */
const getRandomDEVICE_ID = () => {
  return crypto.randomUUID();
};

/**
 * 获取APP_TOKEN
 * @returns APP_TOKEN
 */
const get_app_token = () => {
  const DEVICE_ID = getRandomDEVICE_ID();
  const now = Math.round(Date.now() / 1000);
  const hex_now = "0x" + now.toString(16);
  const md5_now = md5(now.toString());
  const s =
    "token://com.coolapk.market/c67ef5943784d09750dcfbb31020f0ab?" +
    md5_now +
    "$" +
    DEVICE_ID +
    "&com.coolapk.market";
  const md5_s = md5(Buffer.from(s).toString("base64"));
  const token = md5_s + DEVICE_ID + hex_now;
  return token;
};

/**
 * 获取请求头
 * ## 需使用安卓客户端的 Dalvik UA，浏览器 UA 会被 WAF 拦截（ 403 ）
 * @returns 请求头
 */
export const genHeaders = () => {
  return {
    "X-Requested-With": "XMLHttpRequest",
    "X-App-Id": "com.coolapk.market",
    "X-App-Token": get_app_token(),
    "X-Sdk-Int": "29",
    "X-Sdk-Locale": "zh-CN",
    "X-App-Version": "11.0",
    "X-Api-Version": "11",
    "X-App-Code": "2101202",
    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 10; Redmi K30 5G MIUI/V12.0.3.0.QGICMXM) (#Build; Redmi; Redmi K30 5G; QKQ1.191222.002 test-keys; 10) +CoolMarket/11.0-2101202",
  };
};
