import { execSync } from "child_process";
import { ProxyAgent, setGlobalDispatcher } from "undici";
function getSystemProxy() {
    try {
        const output = execSync("scutil --proxy", { encoding: "utf-8" });
        const result = {};
        const httpEnabled = output.match(/HTTPEnable\s*:\s*(\d)/);
        const httpProxy = output.match(/HTTPProxy\s*:\s*(\S+)/);
        const httpPort = output.match(/HTTPPort\s*:\s*(\d+)/);
        if (httpEnabled?.[1] === "1" && httpProxy && httpPort) {
            result.httpProxy = `http://${httpProxy[1]}:${httpPort[1]}`;
        }
        const httpsEnabled = output.match(/HTTPSEnable\s*:\s*(\d)/);
        const httpsProxy = output.match(/HTTPSProxy\s*:\s*(\S+)/);
        const httpsPort = output.match(/HTTPSPort\s*:\s*(\d+)/);
        if (httpsEnabled?.[1] === "1" && httpsProxy && httpsPort) {
            result.httpsProxy = `http://${httpsProxy[1]}:${httpsPort[1]}`;
        }
        return result;
    }
    catch {
        return {};
    }
}
export function initProxy() {
    const proxy = getSystemProxy();
    const proxyUrl = proxy.httpsProxy || proxy.httpProxy;
    if (proxyUrl) {
        // 设置环境变量
        process.env.HTTPS_PROXY = proxyUrl;
        process.env.HTTP_PROXY = proxyUrl;
        process.env.https_proxy = proxyUrl;
        process.env.http_proxy = proxyUrl;
        // 设置 undici 全局代理
        try {
            const agent = new ProxyAgent(proxyUrl);
            setGlobalDispatcher(agent);
            console.log(`Proxy: ${proxyUrl}`);
        }
        catch (err) {
            console.error(`Proxy setup failed: ${err}`);
        }
    }
}
//# sourceMappingURL=proxy.js.map