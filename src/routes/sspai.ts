import type { RouterData, ListContext, Options } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

// 有效分类，未知分类回退到默认
const typeList = ["热门文章", "应用推荐", "生活方式", "效率技巧", "少数派播客"];

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  const rawType = c.req.query("type") || "热门文章";
  const type = typeList.includes(rawType) ? rawType : "热门文章";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "sspai",
    title: "少数派",
    type: "热榜",
    params: {
      type: {
        name: "分类",
        type: ["热门文章", "应用推荐", "生活方式", "效率技巧", "少数派播客"],
      },
    },
    link: "https://sspai.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface SspaiAuthor {
  nickname: string;
}

interface SspaiItem {
  id: string;
  title: string;
  summary: string;
  banner: string;
  author: SspaiAuthor;
  released_time: number;
  like_count: number;
}

interface SspaiResponse {
  data: SspaiItem[];
}

const getList = async (options: Options, noCache: boolean) => {
  // handleRoute 已校验 type 为有效字符串
  const type = String(options.type ?? "热门文章");
  const url = `https://sspai.com/api/v1/article/tag/page/get?limit=40&tag=${encodeURIComponent(type)}`;
  const result = await get<SspaiResponse>({
    url,
    noCache,
    // 该接口响应缓慢且波动大，放宽超时
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: "https://sspai.com/",
    },
  });
  const list = result.data?.data ?? [];
  if (!list.length) {
    // 该分类可能上游本就无数据（如 效率技巧 ），或数据源异常
    logger.warn(`⚠️ [WARN] 少数派数据为空（ type=${type} ）`);
    return { ...result, data: [] };
  }
  return {
    ...result,
    data: list.map((v) => ({
      id: v.id,
      title: v.title,
      desc: v.summary,
      // banner 为相对路径，补全为完整 URL
      cover: v.banner ? `https://cdnfile.sspai.com/${v.banner.replace(/^\//, "")}` : undefined,
      author: v.author?.nickname || undefined,
      timestamp: getTime(v.released_time),
      hot: v.like_count,
      url: `https://sspai.com/post/${v.id}`,
      mobileUrl: `https://sspai.com/post/${v.id}`,
    })),
  };
};
