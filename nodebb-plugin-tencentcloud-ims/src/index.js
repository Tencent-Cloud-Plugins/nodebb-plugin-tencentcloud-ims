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
const nconf = require.main.require('nconf');
const mime = require('mime');
const { request, url2Base64, handleError } = require('./util');

const Plugin = {};
const specialPostType = 'topic';
const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];

Plugin.topicCreateOrEdit = async (data) => {
  const { content } = data.data;
  const imageData = Plugin.getImageData(content);
  try {
    await Plugin.postImageIms(imageData);
  } catch (error) {
    throw handleError(error);
  }
  data.data.postType = specialPostType;
  return data;
};

Plugin.postCreateOrEdit = async (data) => {
  if (data.data.postType === specialPostType) {
    // 新建或编辑topic后触发的，不再做处理
    return data;
  }
  const { content } = data.data;
  const imageData = Plugin.getImageData(content);
  try {
    await Plugin.postImageIms(imageData);
  } catch (error) {
    throw handleError(error);
  }
  return data;
};

Plugin.getImageData = (str) => {
  const pattern = /!?\[(.*?)\]\(([^(]*?)\)/gm;
  const result = [];
  let matcher;

  while ((matcher = pattern.exec(str)) !== null) {
    const type = mime.getType(matcher[2]);
    if (type && allowedMimeTypes.includes(type)) {
      const obj = {
        alt: matcher[1],
        url: matcher[2]
      };
      const arr = obj.url.split('/');
      obj.name = arr[arr.length - 1];
      result.push(obj);
    }
  }

  return result;
};

Plugin.postImageIms = async (imageData) => {
  if (!imageData.length) {
    return;
  }

  for (const imgObj of imageData) {
    let imageUrl = imgObj.url;
    if (!imageUrl.startsWith('http')) {
      imageUrl = nconf.get('url') + imageUrl;
    }
    const imageContent = await url2Base64(imgObj.name, imageUrl);
    if (!imageContent) {
      continue;
    }
    const imsResult = await request('ImageModeration', {
      FileContent: imageContent
    });
    if (imsResult.HitFlag) {
      throw new Error(`图片【${imgObj.name}】可疑，含有令人反感、不安全或不适宜内容`);
    }
  }
};

module.exports = Plugin;
