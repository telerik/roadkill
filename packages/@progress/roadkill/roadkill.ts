#!/usr/bin/env node

import { readFile, stat, access, mkdir, rm, symlink } from "fs/promises";
import { exec as execAsync } from "child_process";
import { promisify } from "util";
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import plist from "plist";
import { fileURLToPath } from "url";
import { basename, delimiter, dirname, join, parse } from "path";

import * as https from "https";
import * as fs from "fs";
import decompress from "decompress";

const exec = promisify(execAsync);

function toChromePlatform(system: { os: OS, arch: Arch}): undefined | "linux64" | "mac-arm64" | "mac-x64" | "win32" | "win64" {
    if (system.os == "Linux") {
        if (system.arch == "x64") return "linux64";
    } else if (system.os == "MacOS") {
        if (system.arch == "arm64") return "mac-arm64";
        if (system.arch == "x64") return "mac-x64";
    } else if (system.os == "Windows") {
        if (system.arch == "x64") return "win64";
        // TODO: What is win32 arch?
    }
    return undefined;
}

interface ChromeDownload {
    platform: "linux64" | "mac-arm64" | "mac-x64" | "win32" | "win64";
    url: string;
}

interface KnownGoodVersionsWithDownloads {
    timestamp: string;
    versions: {
        version: string,
        revision: string,
        downloads: {
            chrome?: ChromeDownload[],
            "chrome-headless-shell"?: ChromeDownload[],
            chromedriver: ChromeDownload[],
        }
    }[];
}

yargs(hideBin(process.argv))
    .command("status", "display system information related to e2e testing", async () => {
        console.log("Checking up system...");
        const system = getSystem();
        console.log(`Operating system ${system.os} (${system.arch})`);

        console.log(`In $PATH:`);
        for(const dir of process.env?.PATH?.trim()?.split(delimiter)) {
            console.log(`  ${dir}`);
        }

        if (system.os == "MacOS") {

            // Check for Safari
            const safariExecutablePath = "/Applications/Safari.app/Contents/MacOS/Safari";
            try {
                if (!(await stat(safariExecutablePath)).isFile()) {
                    throw new Error(`Safari executable does not exists at path ${safariExecutablePath}`);
                }
                const safariPlist: any = plist.parse(await (await readFile("/Applications/Safari.app/Contents/Info.plist")).toString());
                console.log(`Safari: ${safariPlist.CFBundleShortVersionString} (${safariPlist.CFBundleVersion}) at ${safariExecutablePath}`);
            } catch(e) {
                console.log(`Failed to locate Safari at "${safariExecutablePath}". ${e}`);
            }

            // Check for safaridriver
            try {
                const safaridriver = (await exec("safaridriver --version")).stdout.toString().trim();
                console.log(`safaridriver is available at PATH: ${safaridriver}`);
            } catch(e) {
                console.log(`safaridriver failed to locate at PATH. ${e}`);
            }

            // Check for Chrome
            let installedChromeVersion: string = undefined;
            const chromeExecutablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
            try {
                if (!(await stat(chromeExecutablePath)).isFile()) {
                    throw new Error(`Safari executable does not exists at path ${chromeExecutablePath}`);
                }
                const chromePlist: any = plist.parse(await (await readFile("/Applications/Google Chrome.app/Contents/Info.plist")).toString());
                console.log(`Chrome: ${chromePlist.CFBundleShortVersionString} (${chromePlist.CFBundleVersion}) at ${chromeExecutablePath}`);
                installedChromeVersion = chromePlist.CFBundleShortVersionString;
            } catch(e) {
                console.log(`Failed to locate Chrome at "${chromeExecutablePath}". ${e}`);
            }

            // Check for chromedriver
            let chromedriverAtPathVersion: string = undefined;
            try {
                const chromedriver = (await exec("chromedriver --version")).stdout.toString().trim();
                console.log(`chromedriver available at PATH: ${chromedriver}`);
            } catch(e) {
                console.log(`chromedriver failed to locate at PATH. ${e}`);
            }

            // Looking for downloadable chromedriver from "known good versions with downloads"
            let bestFitChromeDownloadUrl: string = undefined;
            try {
                if (!installedChromeVersion) {
                    throw new Error("Checking for chromedriver download requires local installation of chrome.");
                }

                const installedChromeVersionNumber = installedChromeVersion.split(".").map(s => Number.parseInt(s));
                let bestFitVersion: [number, number, number, number] = undefined;
                const catalog: KnownGoodVersionsWithDownloads = await (await fetch("https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json")).json();

                const chromePlatform = toChromePlatform(system);

                for(const version of catalog.versions) {

                    if (!version?.downloads?.chromedriver) continue;
                    let chromeDownloadUrl: string = undefined;
                    for(const chromedriverDownload of version?.downloads?.chromedriver) {
                        if (chromedriverDownload.platform == chromePlatform) {
                            chromeDownloadUrl = chromedriverDownload.url;
                        }
                    }
                    if (!chromeDownloadUrl) continue;

                    const downloadVersion = version.version.split(".").map(s => Number.parseInt(s)) as [number, number, number, number];
                    if (downloadVersion[0] != installedChromeVersionNumber[0]) continue;
                    if (downloadVersion[1] != installedChromeVersionNumber[1]) continue;
                    if (downloadVersion[2] != installedChromeVersionNumber[2]) continue;

                    if (bestFitVersion && bestFitVersion[3] > downloadVersion[3]) continue;

                    bestFitVersion = downloadVersion;
                    bestFitChromeDownloadUrl = chromeDownloadUrl;
                }

                if (bestFitVersion) {
                    console.log(`chromedriver download for chrome ${installedChromeVersion}, suggested ${bestFitVersion.join(".")}, URL:\n${bestFitChromeDownloadUrl}`);
                } else {
                    console.log(`chromedriver could not find compatible version for chrome ${installedChromeVersion}`);
                }

                // TODO: Download and unzip
            } catch(e) {
                console.log(`Failed to lookup chromedriver download. ${e}`);
            }

            try {
                if (process.argv.indexOf("--get-chromedriver") != -1) {
                    if (!installedChromeVersion) {
                        throw new Error("The --get-chromedriver flag was provided, but no local installation of the chrome browser was found.");
                    }
                    if (!bestFitChromeDownloadUrl) {
                        throw new Error("The --get-chromedriver flag was provided, but no suitable chromedriver download was found.");
                    }

                    const binDir = await getBinDir();
                    
                    
                    const downloadsDir = join(dirname(fileURLToPath(import.meta.url)), "downloads");
                    const zipFileName = basename(bestFitChromeDownloadUrl);
                    const zipLocation = join(downloadsDir, zipFileName);
                    console.log(`  Downloading chromedriver`);
                    console.log(`    from: ${bestFitChromeDownloadUrl}`);
                    console.log(`    to ${zipLocation}`);
                    let percent = -1;
                    await download(bestFitChromeDownloadUrl, zipLocation, (current, total) => {
                        let newPercent = Math.floor((current / total * 100) / 10) * 10;
                        if (newPercent == percent) return;
                        console.log(`    downloading ${current} / ${total} (${newPercent}%)`);
                        percent = newPercent;
                    });
                    console.log("    Download complete!");
                    
                    const unzippedLocation = join(downloadsDir, parse(zipFileName).name);
                    console.log(`  Unzip`);
                    console.log(`    from: ${zipLocation}`);
                    console.log(`    to: ${unzippedLocation}`);
                    unzip(zipLocation, unzippedLocation);
                    console.log(`    Unzip complete!`);

                    const binChromeDriver = join(binDir, "chromedriver");
                    // TODO: On windows it will probably be chromedriver.exe
                    const chromedriverUnzippedLocation = join(unzippedLocation, "chromedriver");
                    console.log(`  Symlink binary`);
                    console.log(`    from: ${binChromeDriver}`);
                    console.log(`    to: ${chromedriverUnzippedLocation}`);
                    await rm(binChromeDriver, { recursive: true, force: true });
                    await symlink(chromedriverUnzippedLocation, binChromeDriver);
                    console.log(`    Symlink complete!`);
                }
            } catch(cause) {
                console.log(`Failed to get chromedriver. ${cause}`);
            }
        }
    })
    .parse();

function getSystem(): { os: OS, arch: Arch} {
    return { os: getOS(), arch: getArch() };
}

type OS = "MacOS" | "Windows" | "Linux";
function getOS(): OS {
    switch (process.platform) {
        case "win32": return "Windows";
        case "linux": return "Linux";
        case "darwin": return "MacOS";
        default: throw new Error(`OS ${process.platform} not supported.`);
    }
}

type Arch = "arm64" | "x64";
function getArch(): Arch {
    switch (process.arch) {
        case "arm64": return "arm64";
        case "x64": return "x64";
        default: throw new Error(`CPU architecture ${process.arch} not supported.`);
    }
}

async function getBinDir(): Promise<string> {
    const scriptPath = fileURLToPath(import.meta.url);
    let baseBin = dirname(scriptPath);
    let bin = undefined;
    while (true) {
        const binPathAttempt = join(baseBin, "node_modules", ".bin");
        try {
            await access(binPathAttempt);
            bin = binPathAttempt;
        } catch {}
        const next = dirname(baseBin);
        if (!next || (next == baseBin)) break;
        baseBin = next;
    }

    if (!bin) throw new Error("The 'node_modules/.bin' not found in any of the parent directories.");
    return bin;
}

function download(url: string, path: string, progress?: (current: number, total: number) => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
        await mkdir(dirname(path), { recursive: true });
        const file = fs.createWriteStream(path);
        https.get(url, response => {
            const total = Number.parseInt(response.headers["content-length"]);
            let current = 0;
            progress?.(current, total);
            response.pipe(file);
            response.on("data", data => progress?.(current += data.length, total));
            response.on("error", (e) => {
                reject(e);
                file.close();
            });
            file.on("error", e => {
                reject(e);
                file.close();
            });
            file.on("finish", () => {
                resolve();
                file.close();
            });
        });
    });   
}

async function unzip(path, dir, progress?: (current: number, total: number) => void): Promise<void> {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await decompress(path, dir, { strip: 1 });
}