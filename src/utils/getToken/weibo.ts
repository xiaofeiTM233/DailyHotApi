// 获取微博访客 Cookie（ SUB / SUBP ）
import { getCache, setCache, delCache } from "../cache.js";
import { post } from "../getData.js";
import logger from "../logger.js";

interface VisitorData {
  sub?: string;
  subp?: string;
}

interface VisitorResponse {
  retcode?: number;
  msg?: string;
  data?: VisitorData;
}

// 访客接口地址与回调名
const VISITOR_URL = "https://passport.weibo.com/visitor/genvisitor2";
const VISITOR_CALLBACK = "visitor_gray_callback";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0";

// 缓存键名与缓存时长（ 秒 ）
const CACHE_KEY = "weibo-visitor-cookie";
const COOKIE_TTL = 6 * 60 * 60;

// 正在进行的请求，避免并发时重复获取
let pendingRequest: Promise<string | undefined> | null = null;

// 从 Set-Cookie 中提取所需字段
const pickFromHeaders = (setCookie: string[] = []): string | undefined => {
  const cookies = setCookie.map((item) => item.split(";")[0].trim());
  const sub = cookies.find((item) => item.startsWith("SUB="));
  const subp = cookies.find((item) => item.startsWith("SUBP="));
  if (!sub) return undefined;
  return subp ? `${sub}; ${subp}` : sub;
};

// 从 JSONP 响应体中提取所需字段
const pickFromBody = (body: string): string | undefined => {
  const matched = body.match(new RegExp(`${VISITOR_CALLBACK}\\((\\{.*\\})\\)`, "s"));
  if (!matched?.[1]) return undefined;
  const visitor = JSON.parse(matched[1]) as VisitorResponse;
  if (visitor.retcode !== 20000000 || !visitor.data?.sub) {
    throw new Error(visitor.msg || `获取微博访客 Cookie 失败（ ${visitor.retcode} ）`);
  }
  const { sub, subp } = visitor.data;
  return subp ? `SUB=${sub}; SUBP=${subp}` : `SUB=${sub}`;
};

// 向微博访客系统申请 Cookie
const fetchVisitorCookie = async (): Promise<string | undefined> => {
  const result = await post<{ data?: string; headers?: { "set-cookie"?: string[] } }>({
    url: VISITOR_URL,
    // 访客接口每次都会下发新的 Cookie，无需缓存响应
    noCache: true,
    originaInfo: true,
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://passport.weibo.com/visitor/visitor",
      Origin: "https://passport.weibo.com",
    },
    body: `cb=${VISITOR_CALLBACK}`,
  });
  // 优先从响应体中解析，其次回退到 Set-Cookie
  const body = typeof result.data?.data === "string" ? result.data.data : "";
  const cookie = (body && pickFromBody(body)) || pickFromHeaders(result.data?.headers?.["set-cookie"]);
  if (!cookie) throw new Error("解析微博访客数据失败");
  return cookie;
};

// 获取微博访客 Cookie，优先使用缓存
const getWeiboCookie = async (forceRefresh: boolean = false): Promise<string | undefined> => {
  if (forceRefresh) await delCache(CACHE_KEY);
  const cachedData = await getCache(CACHE_KEY);
  if (cachedData?.data) return cachedData.data as string;
  // 复用正在进行的请求
  if (!pendingRequest) {
    pendingRequest = fetchVisitorCookie()
      .then(async (cookie) => {
        await setCache(
          CACHE_KEY,
          { data: cookie, updateTime: new Date().toISOString() },
          COOKIE_TTL,
        );
        return cookie;
      })
      .catch((error) => {
        logger.error(
          `❌ [ERROR] 获取微博访客 Cookie 失败：${error instanceof Error ? error.message : "未知错误"}`,
        );
        return undefined;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }
  return pendingRequest;
};

export default getWeiboCookie;
