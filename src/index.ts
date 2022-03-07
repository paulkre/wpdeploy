import { EOL } from "os";
import puppeteer, { Browser, Page } from "puppeteer";
import { Result, Ok, Err } from "./results.js";

export type WpDeployPackageType = "theme" | "plugin";

export type WpDeployProps = {
  filePath: string;
  user: string;
  password: string;
  url: string;
  type: WpDeployPackageType;
  data: Buffer;
  logHandler?: (msg: string) => void;
};

async function login(
  page: Page,
  { url, user, password }: WpDeployProps
): Promise<Result<void, string>> {
  await page.goto(`${url}/wp-login.php`);
  await page.waitForSelector("#wp-submit");

  // Timeout is necessary because Puppeteer sometimes starts typing too early
  await page.waitForTimeout(1000);

  await page.type("#user_login", user);
  await page.type("#user_pass", password);
  await page.click("#wp-submit");
  await page.waitForNavigation();
  if (page.url().match(/\/wp-login\.php$/)) {
    const errorMessage = (
      await page.evaluate(
        () => document.querySelector<HTMLDivElement>("#login_error")?.innerText
      )
    )?.match(/^Error: (.*)/)?.[1];
    return Err(errorMessage || "Unknown error");
  }
  return Ok(undefined);
}

async function isAlreadyInstalled(
  page: Page
): Promise<Result<boolean, string>> {
  let reps = 30;
  while (reps > 0) {
    reps--;
    const alreadyExists = await page.evaluate(() => {
      const text = document.querySelector<HTMLDivElement>(
        "#wpbody-content > .wrap"
      )?.innerText;
      if (!text) return null;

      if (text.match(/Destination folder already exists\./)) return true;
      if (text.match(/(Plugin|Theme) installed successfully\./)) return false;
      return null;
    });
    if (alreadyExists != null) return Ok(alreadyExists);
    await page.waitForTimeout(1000);
  }

  return Err("It took too loong to check whether package is already installed");
}

async function runDeploy(
  browser: Browser,
  props: WpDeployProps
): Promise<Result<void, string>> {
  const { url, filePath, type, logHandler: log } = props;

  const page = await browser.newPage();
  const loginResult = await login(page, props);
  if (loginResult.err) return Err(`Login failed:${EOL}${loginResult.val}`);
  log?.("Login successful");

  await page.goto(`${url}/wp-admin/${type}-install.php`);
  await page.click(".upload-view-toggle");

  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click(`#${type}zip`),
  ]);
  await fileChooser.accept([filePath]);
  await page.click(`#install-${type}-submit`);
  await page.waitForNavigation();

  const overwriteBtnSel = "a.update-from-upload-overwrite";

  const isAlreadyInstalledResult = await isAlreadyInstalled(page);
  if (isAlreadyInstalledResult.err)
    return Err(`Upload may have failed: ${isAlreadyInstalledResult.val}`);

  log?.("Upload successful");

  if (isAlreadyInstalledResult.val) {
    log?.(
      `${type.charAt(0).toUpperCase()}${type.substring(
        1
      )} already exists. Overwriting...`
    );
    await page.waitForSelector(overwriteBtnSel);
    await page.click(overwriteBtnSel);
    await page.waitForNavigation();
  }

  return Ok(undefined);
}

export async function wpDeploy(
  props: WpDeployProps
): Promise<Result<void, string>> {
  const browser = await puppeteer.launch();
  const deployResult = await runDeploy(browser, props);
  await browser.close();
  return deployResult;
}
