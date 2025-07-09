const fs = require("fs");
const path = require("path");
const https = require("https");

const FLAGS = ["us", "cn", "jp", "kr", "fr", "de", "es", "gb", "it", "ru", "sa", "tr", "ua", "vn"];
const TARGET_DIR = path.resolve(__dirname, "../src/renderer/src/assets/flags");

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFlag(code) {
    return new Promise((resolve, reject) => {
        const url = `https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${code}.svg`;
        const filePath = path.join(TARGET_DIR, `${code.toUpperCase()}.svg`);
        const file = fs.createWriteStream(filePath);
        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                    return;
                }
                response.pipe(file);
                file.on("finish", () => {
                    file.close(resolve);
                });
            })
            .on("error", (err) => {
                fs.unlink(filePath, () => reject(err));
            });
    });
}

(async () => {
    for (const code of FLAGS) {
        try {
            await downloadFlag(code);
            console.log(`Downloaded ${code.toUpperCase()}.svg`);
        } catch (err) {
            console.error(`Failed to download ${code.toUpperCase()}.svg:`, err.message);
        }
    }
})();
