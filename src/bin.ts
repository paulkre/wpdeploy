#!/usr/bin/env node

import meow from "meow";
import promptsBase, { PromptObject } from "prompts";
import fs, { existsSync } from "fs";
import { resolve as resolvePath } from "path";

import { wpDeploy, WpDeployPackageType } from "./index.js";

const { readFile } = fs.promises;

const prompts = (questions: Parameters<typeof promptsBase>[0]) =>
  promptsBase(questions, {
    onCancel() {
      process.exit(0);
    },
  });

const promptText = (message: string, cfg?: Partial<PromptObject>) =>
  prompts({
    name: "answer",
    type: "text",
    validate: (value) => !!value.length,
    message,
    ...cfg,
  }).then((result) => result.answer as string);

const cli = meow(
  `
Usage: wpdeploy [options...] <file>
  --url <url>              Specify the URL pointing the WordPress installation
  -u, --user <username>    Specify the username for authentication 
  -p, --password <passwd>  Specify the password for authentication 
  -t, --type theme|plugin  Specify the type of package to deploy (plugin or theme)
  -q, --quiet              Disable logging
  -v, --version            Show version number
`,
  {
    importMeta: import.meta,
    flags: {
      help: { alias: "h", type: "boolean" },
      version: { alias: "v", type: "boolean" },
      user: { alias: "u", type: "string" },
      password: { alias: "p", type: "string" },
      url: { type: "string" },
      type: { alias: "t", type: "string" },
      quiet: { alias: "q", type: "boolean" },
    },
    allowUnknownFlags: false,
  }
);

const [fileInput] = cli.input;
let { url, type, quiet, user, password } = cli.flags;

const isWpDeployAssetType = (value?: string): value is WpDeployPackageType =>
  value == "theme" || value == "plugin";

(async () => {
  if (!fileInput) {
    console.log("Please provide a file to deploy");
    process.exit(1);
  }

  const filePath = resolvePath(fileInput);

  if (!existsSync(filePath)) {
    console.log(`File ${filePath} does not exist`);
    process.exit(1);
  }

  const deployResult = await wpDeploy({
    filePath,
    data: await readFile(filePath),
    url: url || (await promptText("Site URL?")),
    user: user || (await promptText("WordPress username?")),
    password: password || (await promptText("WordPress password?")),
    type: isWpDeployAssetType(type)
      ? type
      : ((await promptText("Deploy theme or plugin?", {
          initial: "theme",
          validate: isWpDeployAssetType,
        })) as WpDeployPackageType),
    logHandler: !quiet ? (msg) => console.log(`> ${msg}`) : undefined,
  });

  if (deployResult.ok) console.log("> Deployment successful");
  else console.log(deployResult.val);
})();
