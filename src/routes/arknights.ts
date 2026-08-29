import type { RouterData, ListContext, Options, RouterResType } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";
import { load } from "cheerio";

// 新闻分类，键名对应请求参数
const typeMap: Record<string, string> = {
  latest: "最新",
  announcement: "公告",
  activity: "活动",
  news: "资讯",
  all: "全部",
};

// 分类与页面数据中分组键名的对应关系
const groupMap: Record<string, string> = {
  latest: "LATEST",
  announcement: "ANNOUNCEMENT",
  activity: "ACTIVITY",
  news: "NEWS",
};

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  // 未知分类回退到默认
  const rawType = c.req.query("type") || "latest";
  const type = rawType in typeMap ? rawType : "latest";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "arknights",
    title: "明日方舟",
    type: typeMap[type],
    description: "官方新闻与公告",
    params: {
      type: {
        name: "新闻分类",
        type: typeMap,
      },
    },
    link: "https://ak.hypergryph.com/news",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface AkNewsItem {
  cid: string;
  title: string;
  author: string;
  displayTime: number;
  brief: string;
}

interface AkNewsGroup {
  list?: AkNewsItem[];
}

type AkInitialData = Record<string, AkNewsGroup>;

// 在 Next.js 内联数据中递归查找 initialData
const findInitialData = (data: unknown): AkInitialData | undefined => {
  if (!data || typeof data !== "object") return undefined;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findInitialData(item);
      if (found) return found;
    }
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (record.initialData && typeof record.initialData === "object") {
    return record.initialData as AkInitialData;
  }
  for (const value of Object.values(record)) {
    const found = findInitialData(value);
    if (found) return found;
  }
  return undefined;
};

// 从页面脚本中提取 initialData
const parseInitialData = (html: string): AkInitialData | undefined => {
  const $ = load(html);
  const scriptText = $("script")
    .toArray()
    .map((el) => $(el).text() || "")
    .find((text) => text.includes("initialData"));
  if (!scriptText) return undefined;

  // 脚本内容形如 self.__next_f.push([1,"e:[...]"])，去掉 e: 前缀后为合法 JSON
  const pushed = scriptText.match(/self\.__next_f\.push\((.+)\)/s);
  let candidates: unknown[] = [];
  if (pushed) {
    try {
      candidates = JSON.parse(pushed[1]) as unknown[];
    } catch {
      candidates = [];
    }
  }
  if (!candidates.length) candidates = [scriptText];

  for (const candidate of candidates) {
    const text = typeof candidate === "string" ? candidate.replace(/^e:/, "") : "";
    if (!text.includes("initialData")) continue;
    try {
      const found = findInitialData(JSON.parse(text));
      if (found) return found;
    } catch {
      // 当前候选解析失败时继续尝试下一个
    }
  }
  return undefined;
};

const getList = async (options: Options, noCache: boolean): Promise<RouterResType> => {
  const { type } = options;
  const typeKey = String(type);
  const url = `https://ak.hypergryph.com/news`;
  const result = await get<string>({
    url,
    noCache,
    ttl: 1800,
    timeout: 15000,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://ak.hypergryph.com/",
    },
  });

  const html = typeof result.data === "string" ? result.data : "";
  const initialData = parseInitialData(html);
  if (!initialData) {
    logger.warn(`⚠️ [WARN] 明日方舟新闻未解析到数据，页面结构可能已变化（ type=${typeKey} ）`);
    return { ...result, data: [] };
  }

  // LATEST 分组与其余分组存在重合，合并时按 cid 去重
  const groupKeys =
    typeKey === "all"
      ? Object.keys(initialData)
      : [groupMap[typeKey]].filter((key) => key && key in initialData);

  const seen = new Set<string>();
  const items: AkNewsItem[] = [];
  for (const key of groupKeys) {
    for (const item of initialData[key]?.list ?? []) {
      if (!item?.cid || seen.has(item.cid)) continue;
      seen.add(item.cid);
      items.push(item);
    }
  }
  // 按发布时间倒序
  items.sort((a, b) => (b.displayTime ?? 0) - (a.displayTime ?? 0));

  if (!items.length) {
    logger.warn(`⚠️ [WARN] 明日方舟新闻数据为空（ type=${typeKey} ）`);
    return { ...result, data: [] };
  }

  return {
    ...result,
    data: items.map((v) => {
      const link = `https://ak.hypergryph.com/news/${v.cid}`;
      return {
        id: v.cid,
        title: v.title,
        desc: v.brief?.trim() || undefined,
        author: v.author || undefined,
        hot: undefined,
        timestamp: getTime(v.displayTime),
        url: link,
        mobileUrl: link,
      };
    }),
  };
};
