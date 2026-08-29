import type { RouterData, ListContext, Options, RouterResType } from "../types.js";
import { get } from "../utils/getData.js";
import logger from "../utils/logger.js";

const typeMap: Record<string, string> = {
  realtime: "热搜",
  novel: "小说",
  movie: "电影",
  teleplay: "电视剧",
  car: "汽车",
  game: "游戏",
};

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  const type = c.req.query("type") || "realtime";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "baidu",
    title: "百度",
    type: typeMap[type],
    params: {
      type: {
        name: "热搜类别",
        type: typeMap,
      },
    },
    link: "https://top.baidu.com/board",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface BaiduItem {
  index?: number;
  word?: string;
  title?: string;
  desc?: string;
  img?: string;
  imgInfo?: { src: string };
  show?: string;
  hotScore?: string;
  hotTag?: string;
  query?: string;
  rawUrl?: string;
  url?: string;
  content?: BaiduItem[];
}

interface BaiduSData {
  data?: { cards?: Array<{ content?: BaiduItem[] }> };
  cards?: Array<{ content?: BaiduItem[] }>;
}

// 判断是否为有效的榜单条目，用于过滤风控页面或结构变化产生的无效数据
const isValidItem = (item: BaiduItem): boolean => {
  const title = item?.word ?? item?.title;
  return typeof title === "string" && title.trim().length > 0;
};

// 递归展开卡片内容，仅保留有效条目
const collectItems = (content: BaiduItem[] | undefined, items: BaiduItem[]): void => {
  for (const item of content ?? []) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item.content)) collectItems(item.content, items);
    if (isValidItem(item)) items.push(item);
  }
};

// 从卡片中提取榜单条目，兼容不同 tab 的嵌套结构
const extractItems = (sData: BaiduSData): BaiduItem[] => {
  const cards = sData?.data?.cards ?? sData?.cards ?? [];
  const items: BaiduItem[] = [];
  for (const card of cards) collectItems(card?.content, items);
  return items;
};

const getList = async (options: Options, noCache: boolean): Promise<RouterResType> => {
  const { type } = options;
  const url = `https://top.baidu.com/board?tab=${type}`;
  const result = await get<string>({
    url,
    noCache,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Referer: "https://top.baidu.com/board",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  // 正则查找
  const pattern = /<!--s-data:(.*?)-->/s;
  const html = typeof result.data === "string" ? result.data : "";
  const matchResult = html.match(pattern);
  if (!matchResult) {
    logger.warn(`⚠️ [WARN] 百度热榜未匹配到 s-data，可能被风控拦截（ tab=${type} ）`);
    return {
      ...result,
      data: [],
    };
  }
  let jsonObject: BaiduItem[] = [];
  try {
    jsonObject = extractItems(JSON.parse(matchResult[1]) as BaiduSData);
  } catch (error) {
    logger.error(
      `❌ [ERROR] 百度热榜数据解析失败：${error instanceof Error ? error.message : "未知错误"}`,
    );
    jsonObject = [];
  }
  if (!jsonObject.length) {
    logger.warn(
      `⚠️ [WARN] 百度热榜未解析到有效条目（ tab=${type} ），可能被风控拦截或页面结构已变化`,
    );
  }
  return {
    ...result,
    data: jsonObject.map((v, index: number) => {
      const title = v.word ?? v.title ?? "";
      return {
        // 置顶项与首条的 index 同为 0，改用数组下标保证 id 唯一
        id: index + 1,
        title,
        desc: v.desc ?? "",
        cover: v.img ?? v.imgInfo?.src ?? "",
        author: typeof v.show === "string" ? v.show : "",
        timestamp: 0,
        hot: parseInt((v.hotScore ?? v.hotTag ?? "0").toString(), 10) || 0,
        url: `https://www.baidu.com/s?wd=${encodeURIComponent(v.query || title)}`,
        mobileUrl: v.rawUrl ?? v.url ?? "",
      };
    }),
  };
};
