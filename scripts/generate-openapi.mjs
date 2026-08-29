// 生成 OpenAPI 3.0 规范文件，自动扫描 src/routes 下所有路由
// 用法: node scripts/generate-openapi.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesDir = join(__dirname, "..", "src", "routes");
const outFile = join(__dirname, "..", "openapi.json");

// 递归查找所有 .ts（排除 .d.ts）
function findTsFiles(dir, base = "") {
  const out = [];
  for (const item of readdirSync(dir)) {
    if (item.endsWith(".d.ts")) continue;
    const full = join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    if (statSync(full).isDirectory()) {
      out.push(...findTsFiles(full, rel));
    } else if (item.endsWith(".ts")) {
      out.push(rel.replace(/\.ts$/, ""));
    }
  }
  return out;
}

// 提取静态字符串字面量，遇到模板插值 ${ 截断
function staticString(raw) {
  if (raw == null) return undefined;
  const s = String(raw);
  const idx = s.indexOf("${");
  return idx >= 0 ? s.slice(0, idx).trim() : s.trim();
}

// 按括号深度匹配关键字后的整个顶层对象块 { ... }
function matchTopLevelBlock(text, startRe) {
  const m = startRe.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length - 1; // 指向首个 {
  let depth = 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(m.index + m[0].length, i); // 返回 { 之后到匹配 } 之前的内容
      }
    }
  }
  return null;
}

// 解析 params 块为查询参数信息
function parseParams(block) {
  // block: 从 "params: {" 到对应的 "}" 之间的内容
  const params = [];
  // 匹配形如  key: { ... }  的字段
  const re = /(\w+)\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const body = m[2];
    const nameMatch = body.match(/name\s*:\s*["'`]([^"'`]+)["'`]/);
    const valueMatch = body.match(/value\s*:\s*["'`]([^"'`]*)["'`]/);
    // 枚举: type: { "1": "x", "2": "y" }
    const typeMatch = body.match(/type\s*:\s*\{([^}]*)\}/);
    let enums = undefined;
    if (typeMatch) {
      const enumRe = /["'`]([^"'`]+)["'`]\s*:\s*["'`]([^"'`]*)["'`]/g;
      let em;
      enums = [];
      while ((em = enumRe.exec(typeMatch[1])) !== null) {
        enums.push({ value: em[1], description: em[2] });
      }
      if (enums.length === 0) enums = undefined;
    }
    params.push({
      key,
      name: nameMatch ? nameMatch[1] : key,
      value: valueMatch ? valueMatch[1] : undefined,
      enums,
    });
  }
  return params;
}

const routes = findTsFiles(routesDir).sort();

const paths = {};
const schemas = {};

// 通用 ListItem schema
schemas.ListItem = {
  type: "object",
  properties: {
    id: { type: ["string", "integer"], description: "条目 ID" },
    title: { type: "string", description: "标题" },
    cover: { type: "string", description: "封面图地址", nullable: true },
    author: { type: "string", description: "作者", nullable: true },
    desc: { type: "string", description: "描述", nullable: true },
    hot: { type: ["number", "integer"], description: "热度值", nullable: true },
    timestamp: { type: "integer", description: "时间戳（秒）", nullable: true },
    url: { type: "string", description: "网页链接" },
    mobileUrl: { type: "string", description: "移动端链接" },
  },
  required: ["id", "title", "hot", "timestamp", "url", "mobileUrl"],
};

// 通用成功响应
function successResponse(title) {
  return {
    description: `${title} 榜单数据`,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            code: { type: "integer", example: 200 },
            name: { type: "string" },
            title: { type: "string" },
            type: { type: "string" },
            description: { type: "string", nullable: true },
            params: { type: "object", nullable: true },
            total: { type: "integer" },
            link: { type: "string", nullable: true },
            updateTime: { type: ["string", "integer"], nullable: true },
            fromCache: { type: "boolean", nullable: true },
            data: { type: "array", items: { $ref: "#/components/schemas/ListItem" } },
          },
        },
      },
    },
  };
}

const errorResponse = {
  description: "错误响应",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          code: { type: "integer" },
          message: { type: "string" },
        },
      },
    },
  },
};

for (const route of routes) {
  const filePath = join(routesDir, `${route}.ts`);
  let src;
  try {
    src = readFileSync(filePath, "utf-8");
  } catch {
    continue;
  }

  // name
  const nameMatch = src.match(/name\s*:\s*["'`]([^"'`]+)["'`]/);
  // title (取静态部分)
  const titleMatch = src.match(/title\s*:\s*["'`]([^"'`]*)/);
  // type
  const typeMatch = src.match(/type\s*:\s*["'`]([^"'`]*)/);
  // description
  const descMatch = src.match(/description\s*:\s*["'`]([^"'`]*)/);

  const name = nameMatch ? nameMatch[1] : route;
  const title = titleMatch ? staticString(titleMatch[1]) || name : name;
  const type = typeMatch ? staticString(typeMatch[1]) || "热榜" : "热榜";
  const description = descMatch ? staticString(descMatch[1]) : undefined;

  // params 块（按括号深度匹配，支持嵌套对象）
  const paramsMatch = matchTopLevelBlock(src, /params\s*:\s*\{/);
  const customParams = paramsMatch ? parseParams(paramsMatch) : [];

  // 构建查询参数
  const parameters = [
    {
      name: "cache",
      in: "query",
      description: "是否使用缓存，传入 false 可强制刷新",
      required: false,
      schema: { type: "string", enum: ["false"], default: "true" },
    },
    {
      name: "limit",
      in: "query",
      description: "限制返回的条目数量",
      required: false,
      schema: { type: "integer" },
    },
    {
      name: "rss",
      in: "query",
      description: "是否输出 RSS（传入 true 返回 XML）",
      required: false,
      schema: { type: "string", enum: ["true"] },
    },
  ];

  for (const p of customParams) {
    const paramDef = {
      name: p.key,
      in: "query",
      description: p.value || p.name,
      required: false,
      schema: p.enums
        ? {
            type: "string",
            enum: p.enums.map((e) => e.value),
            "x-enum-descriptions": p.enums.reduce((acc, e) => {
              acc[e.value] = e.description;
              return acc;
            }, {}),
          }
        : { type: "string" },
    };
    parameters.push(paramDef);
  }

  paths[`/${route}`] = {
    get: {
      summary: `${name} - ${title}`,
      description:
        description ||
        `获取 ${title} 的${type}榜单数据。响应结构统一为 \`{ code, name, title, type, total, data: [...] }\`。`,
      operationId: `get_${route.replace(/[^a-zA-Z0-9]/g, "_")}`,
      tags: ["榜单"],
      parameters,
      responses: {
        200: successResponse(title),
        405: errorResponse,
        500: errorResponse,
      },
    },
  };
}

// /all 路由
paths["/all"] = {
  get: {
    summary: "获取全部路由列表",
    description: "返回当前所有可用的榜单路由信息。",
    operationId: "get_all_routes",
    tags: ["系统"],
    parameters: [],
    responses: {
      200: {
        description: "全部路由列表",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                code: { type: "integer", example: 200 },
                count: { type: "integer" },
                routes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      path: { type: "string", nullable: true },
                      message: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// 公共查询参数 schema（复用）
schemas.QueryParams = {
  type: "object",
  properties: {
    cache: { type: "string", enum: ["false"], description: "传入 false 强制刷新" },
    limit: { type: "integer", description: "限制返回条目数" },
    rss: { type: "string", enum: ["true"], description: "传入 true 输出 RSS" },
  },
};

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "DailyHot API",
    version: "2.0.8",
    description:
      "一个聚合各大平台热榜数据的 API 服务。所有榜单接口统一通过 `GET /{平台}` 访问，响应结构一致。\n\n通用查询参数：\n- `cache=false` 强制刷新缓存\n- `limit=N` 限制返回条目数\n- `rss=true` 返回 RSS（XML）格式",
    license: { name: "MIT", url: "https://github.com/imsyy/DailyHotApi/blob/master/LICENSE" },
  },
  servers: [
    { url: "http://localhost:6688", description: "本地默认服务" },
    { url: "https://api.imsyy.top", description: "官方示例服务" },
  ],
  tags: [{ name: "榜单", description: "各平台热榜数据接口" }],
  paths,
  components: {
    schemas,
    responses: {
      Error: errorResponse,
    },
  },
};

writeFileSync(outFile, JSON.stringify(openapi, null, 2), "utf-8");
console.log(`✅ 已生成 openapi.json，共 ${routes.length} 个榜单路由。`);
