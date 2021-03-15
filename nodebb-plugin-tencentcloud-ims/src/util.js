/*
 * Copyright (C) 2020 Tencent Cloud.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const winston = require.main.require('winston');
const { sign, reportToBI } = require('../../nodebb-plugin-tencentcloud-common/src/common');

/**
 * 请求腾讯云图片内容安全公共方法
 * @param {string} action - 接口请求action
 * @param {object} payload - 接口请求体
 * @returns {object} API返回的有效数据
 */
async function request(action, payload) {
  // 异步进行数据上报，不阻塞主流程
  reportToBI('ims', {});

  const [timestamp, authorization] = await sign('ims', JSON.stringify(payload));
  const response = await axios({
    url: 'https://ims.tencentcloudapi.com',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TC-Action': action,
      'X-TC-Region': 'ap-guangzhou',
      'X-TC-Version': '2020-07-13',
      'X-TC-Timestamp': timestamp,
      Authorization: authorization
    },
    data: payload
  });
  const { status, statusText, data } = response;
  if (status !== 200) {
    throw new Error(`${action}接口调用失败[${status} - ${statusText}]`);
  }
  if (data.Response.Error) {
    throw new Error(data.Response.Error.Message);
  }
  return data.Response;
}

/**
 * blob文件转换base64格式
 * @param {string} filePath 文件对象path
 * @returns {string} result base64格式的数据
 */
function blob2Base64(filePath) {
  const data = fs.readFileSync(path.resolve(filePath));
  const base64Data = data.toString('base64');

  return base64Data;
}

/**
 * 网络url转换base64格式
 * @param {string} name 图片名
 * @param {string} url 图片路径
 * @returns {string} result base64格式的数据
 */
async function url2Base64(name, url) {
  try {
    const { status, data } = await axios.get(encodeURI(url), {
      responseType: 'arraybuffer'
    });
    let base64Data = '';
    if (status === 200 && data) {
      base64Data = data.toString('base64');
    }

    return base64Data;
  } catch (error) {
    throw new Error(`图片【${name}】无法访问`);
  }
}

/**
 * 错误处理函数
 * @param {object | string} err 错误信息
 * @return {object} err 错误信息
 */
function handleError(err) {
  if (!(err instanceof Error)) {
    err = new Error(err);
  }
  winston.error(err.message);

  return err;
}

module.exports = { request, blob2Base64, url2Base64, handleError };
