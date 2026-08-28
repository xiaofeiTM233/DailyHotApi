import type { RouterData, ListContext, Options, RouterResType } from "../types.js";
import { post } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

const typeMap: Record<string, string> = {
  hot: "人气榜",
  video: "视频榜",
  comment: "热议榜",
  collect: "收藏榜",
};

// 请求字段名与分类的对应关系
const listFieldMap = {
  hot: "hotRankList",
  video: "videoList",
  comment: "remarkList",
  collect: "collectList",
} as const;

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  // 未知分类回退到默认，避免请求到不存在的接口
  const rawType = c.req.query("type") || "hot";
  const type = rawType in typeMap ? rawType : "hot";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "36kr",
    title: "36氪",
    type: typeMap[type],
    params: {
      type: {
        name: "热榜分类",
        type: typeMap,
      },
    },
    link: "https://m.36kr.com/hot-list-m",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface KrTemplateMaterial {
  widgetTitle: string;
  widgetImage: string;
  authorName: string;
  statCollect: number;
}

interface KrItem {
  itemId: string;
  publishTime: string;
  templateMaterial: KrTemplateMaterial;
}

interface KrListData {
  hotRankList: KrItem[];
  videoList: KrItem[];
  remarkList: KrItem[];
  collectList: KrItem[];
}

interface KrResponse {
  data?: KrListData;
}

const getList = async (options: Options, noCache: boolean): Promise<RouterResType> => {
  const { type } = options;
  const field = listFieldMap[(type as keyof typeof listFieldMap) ?? "hot"] ?? "hotRankList";
  const url = `https://gateway.36kr.com/api/mis/nav/home/nav/rank/${type}`;
  const result = await post<KrResponse>({
    url,
    noCache,
    // 该网关偶发响应缓慢，放宽超时
    timeout: 15000,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      Referer: "https://m.36kr.com/",
      Origin: "https://m.36kr.com",
    },
    body: {
      partner_id: "wap",
      param: {
        siteId: 1,
        platformId: 2,
      },
      timestamp: new Date().getTime(),
    },
  });
  const list = result.data?.data?.[field] ?? [];
  if (!list.length) {
    logger.warn(`⚠️ [WARN] 36 氪热榜数据为空（ type=${type} ）`);
    return { ...result, data: [] };
  }
  return {
    ...result,
    data: list.map((v) => {
      const item = v.templateMaterial;
      return {
        id: v.itemId,
        title: item.widgetTitle,
        cover: item.widgetImage,
        author: item.authorName,
        timestamp: getTime(v.publishTime),
        hot: item.statCollect || undefined,
        url: `https://www.36kr.com/p/${v.itemId}`,
        mobileUrl: `https://m.36kr.com/p/${v.itemId}`,
      };
    }),
  };
};
