const rollup = require('rollup');
const path = require('path');
const chalk = require('chalk');
const rmfr = require('rmfr');
const ncp = require('ncp').ncp;
const mkdirp = require('mkdirp');
const fs = require('fs');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const resolve = require('rollup-plugin-node-resolve');
// const resolve = require('rollup-plugin-node-resolve');
const rollupTypescript = require('rollup-plugin-typescript2');
const terser = require('rollup-plugin-terser').terser;
const replace = require('rollup-plugin-replace');
const gzip = require('gzip-size');
const babelCore = require('@babel/core');
const bundles = require('./bundles');

const cwd = process.cwd();

function getPackgeFileName(packageName, bundleType) {
  switch (bundleType) {
    case bundles.CJS:
    case bundles.UMD:
      return `${packageName}.production.min.js`;
    case bundles.UMD_DEV:
    case bundles.CJS_DEV:
      return `${packageName}.development.js`;
    default:
      //
      break;
  }
}

function getFormat(bundleType) {
  switch (bundleType) {
    case bundles.UMD_DEV:
    case bundles.UMD:
      return 'umd';
    case bundles.CJS:
    case bundles.CJS_DEV:
      return 'cjs';
    default:
      //
      break;
  }
  return 'umd';
}

function getOutoutPath(packageName, bundleType, filename) {
  return `build/${packageName}/${getFormat(bundleType)}/${filename}`;
}

function getNodeEnv(bundleType) {
  switch (bundleType) {
    case bundles.CJS:
    case bundles.UMD:
      return 'production';
    case bundles.UMD_DEV:
    case bundles.CJS_DEV:
      return 'development';
    default:
      //
      break;
  }
}

function combinGlobalModule(externals) {
  return externals.reduce((a, b) => ((a[b.entry] = b.global), a), {});
}

function getPackageName(package) {
  return package.split('/')[1];
}

/**
 * rollup build
 * @param {*} package 包
 * @param {*} bundleType  打包类型
 */
async function createBundle(package, bundleType) {
  // 获取文件名称
  const { entry, global: globalName, externals } = package;
  const packageName = getPackageName(entry);
  const packageFileName = getPackgeFileName(packageName, bundleType);
  const tag = chalk.white.bold(packageFileName) + chalk.dim(` (${bundleType})`);
  console.log(chalk.bgYellow.black(' BUILDING   '), tag);

  process.env.NODE_ENV = getNodeEnv(bundleType);
  const isProduction = process.env.NODE_ENV === 'production';


  try {
    const entryFile = require.resolve(entry);
    const bundle = await rollup.rollup({
      input: entryFile,
      external: externals.map(v => v.entry),
      plugins: [
        replace({
          __DEV__: !isProduction,
          __ISSUE__: 'https://github.com/taixw2/dxjs/issues',
        }),
        commonjs(),
        resolve({
          extensions: ['.js', '.ts'],
        }),
        rollupTypescript(),
        babel({
          configFile: path.resolve('.babelrc'),
          exclude: 'node_modules/**',
          runtimeHelpers: true,
          extensions: [...babelCore.DEFAULT_EXTENSIONS, '.ts'],
        }),
        isProduction && terser(),
      ],
    });

    await bundle.write({
      // output option
      preferConst: true,
      file: getOutoutPath(packageName, bundleType, packageFileName),
      format: getFormat(bundleType),
      globals: combinGlobalModule(externals),
      exports: 'auto',
      freeze: false,
      name: globalName,
      interop: false,
      sourcemap: !isProduction,
    });
  } catch (error) {
    console.log(chalk.bgRed.black(' BUILD FAIL '), tag);
    throw error;
  }
  console.log(chalk.bgGreen.black(' COMPLETE   '), tag);
}

async function copyTo(from, to) {
  await mkdirp(path.dirname(to));
  return new Promise((resolve, reject) => {
    ncp(from, to, err => {
      err && reject(err);
      resolve();
    });
  });
}

/**
 * 将未参与打包的资源复制到输出目录中
 */
function copyResource() {
  const tasks = fs.readdirSync(path.join(cwd, 'packages')).map(async name => {
    const fromBaseDir = path.join(cwd, 'packages', name);
    const toBaseDir = path.join(cwd, 'build', name);
    if (!fs.existsSync(toBaseDir)) {
      // 直接复制整个目录到 build
      await mkdirp(toBaseDir);

      await copyTo(fromBaseDir, toBaseDir);
      return;
    }

    await copyTo(path.join(fromBaseDir, 'npm'), path.join(toBaseDir));
    await copyTo('LICENSE', path.join(toBaseDir, 'LICENSE'));
    // await copyTo(path.join(fromBaseDir, 'package.json'), path.join(toBaseDir, 'package.json'));
    await copyTo('README.md', path.join(toBaseDir, 'README.md'));
    const pkg = require(path.join(fromBaseDir, 'package.json'));
    pkg.types = 'src/index.d.ts';

    await fs.promises.writeFile(path.join(toBaseDir, 'package.json'), JSON.stringify(pkg), 'utf-8');
  });

  return Promise.all(tasks);
}

/**
 * 开始 Build
 * 打包 cjs + umd 模块
 */
async function build() {
  await rmfr('build');

  for (let index = 0; index < bundles.packages.length; index++) {
    const package = bundles.packages[index];
    await createBundle(package, bundles.CJS);
    await createBundle(package, bundles.CJS_DEV);
  }
  // 遍历所有的包
  await copyResource();
}

build().catch(error => {
  console.error('build fail', error);
});
