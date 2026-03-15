const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;

let serverProcess;
let mainWindow;

/**
 * When asar packaging is enabled, __dirname resolves inside app.asar (virtual).
 * Files in asarUnpack are unpacked to app.asar.unpacked on disk.
 * We must use that real disk path to spawn the server.
 */
function getStandaloneDir() {
    if (isDev) {
        return path.join(__dirname, ".next", "standalone");
    }
    // Production: asar is disabled, so __dirname is the real app folder on disk
    return path.join(__dirname, ".next", "standalone");
}

/**
 * Finds a free port dynamically.
 */
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = http.createServer();
        srv.listen(0, () => {
            const port = srv.address().port;
            srv.close((err) => {
                if (err) reject(err);
                else resolve(port);
            });
        });
    });
}

/**
 * Waits until the server responds with HTTP 200.
 */
function checkServer(url) {
    return new Promise((resolve) => {
        http
            .get(url, (res) => resolve(res.statusCode === 200))
            .on("error", () => resolve(false));
    });
}

async function waitForServer(url, maxRetries = 60) {
    for (let i = 0; i < maxRetries; i++) {
        const ok = await checkServer(url);
        if (ok) return;
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Server did not start in time.");
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "HO SO THANH TOAN-TAM",
        show: false, // Show only when ready
    });

    mainWindow.setMenuBarVisibility(false);

    if (isDev) {
        mainWindow.loadURL("http://localhost:3000");
        mainWindow.once("ready-to-show", () => mainWindow.show());
    } else {
        try {
            const standaloneDir = getStandaloneDir();
            const serverPath = path.join(standaloneDir, "server.js");
            const port = await getFreePort();
            const url = `http://localhost:${port}`;

            console.log(`[TNEC] Standalone dir: ${standaloneDir}`);
            console.log(`[TNEC] Server path: ${serverPath}`);
            console.log(`[TNEC] Port: ${port}`);

            serverProcess = spawn(process.execPath, [serverPath], {
                env: {
                    ...process.env,
                    NODE_ENV: "production",
                    PORT: String(port),
                    HOSTNAME: "127.0.0.1",
                    ELECTRON_RUN_AS_NODE: "1",
                },
                cwd: standaloneDir,
            });

            serverProcess.stdout.on("data", (data) =>
                console.log(`[Next.js]: ${data}`)
            );
            serverProcess.stderr.on("data", (data) =>
                console.error(`[Next.js Error]: ${data}`)
            );
            serverProcess.on("error", (err) =>
                console.error("[TNEC] Failed to spawn server:", err)
            );

            await waitForServer(url);
            mainWindow.loadURL(url);
            mainWindow.once("ready-to-show", () => mainWindow.show());
        } catch (err) {
            console.error("[TNEC] Startup error:", err);
            // Show the window anyway so the user sees the error
            mainWindow.show();
        }
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});

app.on("activate", () => {
    if (mainWindow === null) createWindow();
});
