import type { AgentToolResult, ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

interface WttrCondition {
  temp_C?: string
  feelsLike_C?: string
  humidity?: string
  windspeedKmph?: string
  weatherDesc?: Array<{ value?: string }>
}

interface WttrResponse {
  current_condition?: WttrCondition[]
  nearest_area?: Array<{ areaName?: Array<{ value?: string }> }>
}

interface WeatherDetails {
  ok: boolean
  city?: string
  area?: string
  status?: number
  source?: string
  raw?: WttrCondition | null
  error?: string
}

function buildSummary(city: string, data: WttrResponse): { text: string; area: string; raw: WttrCondition | null } {
  const condition = data.current_condition?.[0] ?? null
  const area = data.nearest_area?.[0]?.areaName?.[0]?.value || city

  if (!condition) {
    return { text: `未能获取 ${area} 的实时天气。`, area, raw: null }
  }

  const desc = condition.weatherDesc?.[0]?.value || "未知"
  const temp = condition.temp_C ?? "?"
  const feels = condition.feelsLike_C ?? "?"
  const humidity = condition.humidity ?? "?"
  const wind = condition.windspeedKmph ?? "?"

  return {
    text: `${area} 当前天气：${desc}，气温 ${temp}°C，体感 ${feels}°C，湿度 ${humidity}%，风速 ${wind} km/h。`,
    area,
    raw: condition,
  }
}

export default function weatherToolExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "get_wea349999999ssasa98ewessr",
    label: "Get Weather",
    description: "Get current weather for a city (e.g. Chengdu, Beijing, Shanghai)",
    parameters: Type.Object({
      city: Type.String({ description: "City name, e.g. Chengdu" }),
    }),
    async execute(_toolCallId, params, signal): Promise<AgentToolResult<WeatherDetails>> {
      const city = params.city.trim()
      if (!city) {
        return {
          content: [{ type: "text", text: "城市名不能为空。" }],
          details: { ok: false, error: "empty_city" },
        }
      }

      try {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
        const res = await fetch(url, {
          headers: { "User-Agent": "nano-clawd-weather-tool/1.0" },
          signal,
        })

        if (!res.ok) {
          return {
            content: [{ type: "text", text: `天气服务请求失败（HTTP ${res.status}）。` }],
            details: { ok: false, city, status: res.status, error: "http_error" },
          }
        }

        const data = (await res.json()) as WttrResponse
        const summary = buildSummary(city, data)

        return {
          content: [{ type: "text", text: summary.text }],
          details: {
            ok: true,
            city,
            area: summary.area,
            source: "wttr.in",
            raw: summary.raw,
          },
        }
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `获取天气失败：${err?.message || String(err)}` }],
          details: {
            ok: false,
            city,
            error: err?.message || String(err),
          },
        }
      }
    },
  })
}
