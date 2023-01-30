import * as core from '@actions/core';

import {z} from 'zod';
import fs from 'fs';
import fetch, {FormData, fileFromSync} from 'node-fetch';
import glob from 'glob';
import {basename} from 'path';

type State = {
  token: string;
  url: string;
  courseId: number;
  assignmentId: number;
};

const uploadFile = async (state: State, path: string) => {
  if (!fs.statSync(path).isFile())
    throw new Error(`File ${path} is not a file`);
  const file = fileFromSync(path);

  core.info(`Uploading ${path}: ${file.size} bytes to ${state.url}`);

  const uploadBucketForm = new FormData();
  uploadBucketForm.append('name', basename(path));
  uploadBucketForm.append('size', file.size.toString());
  const uploadBucket = z
    .object({
      upload_url: z.string().url(),
      upload_params: z.any()
    })
    .parse(
      await (
        await fetch(
          `${state.url}/api/v1/courses/${state.courseId}/assignments/${state.assignmentId}/submissions/self/files`,
          {
            headers: {
              Authorization: `Bearer ${state.token}`
            },
            method: 'POST',
            body: uploadBucketForm
          }
        )
      ).json()
    );
  core.info(`Uploading ${path}: recieved upload bucket, sending file payload`);

  const uploadForm = new FormData();
  for (const key in uploadBucket.upload_params)
    uploadForm.append(key, uploadBucket.upload_params[key]);
  uploadForm.append('file', file);
  const location = z.string().parse(
    (
      await fetch(uploadBucket.upload_url, {
        method: 'POST',
        body: uploadForm
      })
    ).headers.get('Location')
  );

  core.info(`Uploading ${path}: recieved upload location`);

  // Check if upload succeeded
  const uploadResponse = z
    .object({
      id: z.number(),
      url: z.string().url(),
      content_type: z.string().optional(),
      display_name: z.string().optional(),
      size: z.number().optional()
    })
    .parse(
      await (
        await fetch(location, {
          headers: {
            Authorization: `Bearer ${state.token}`,
            'Content-Length': '0'
          },
          method: 'POST'
        })
      ).json()
    );

  core.info(
    `Uploading ${path}: successfully uploaded file as ${uploadResponse.display_name} with size ${uploadResponse.size}`
  );

  return uploadResponse;
};

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', {required: true});
    const file_pattern = core.getInput('file', {required: true});

    // Parse URL to find course and assignment IDs
    const inputURL = z
      .string()
      .url()
      .parse(core.getInput('url', {required: true}));
    const paths: any = {};
    const unparsedURL = new URL(inputURL);
    const routes = unparsedURL.pathname.split('/').slice(1);
    for (let i = 0; i < routes.length; i += 2) paths[routes[i]] = routes[i + 1];
    const parsedIds = z
      .object({
        courses: z
          .number({
            invalid_type_error: 'Course ID must be a number',
            coerce: true
          })
          .nonnegative()
          .int(),
        assignments: z
          .number({
            invalid_type_error: 'Assignment ID must be a number',
            coerce: true
          })
          .nonnegative()
          .int()
      })
      .parse(paths);

    const state: State = {
      token,
      url: unparsedURL.origin,
      courseId: parsedIds.courses,
      assignmentId: parsedIds.assignments
    };

    // Enumerate all courses
    const courses = z
      .array(
        z.object({
          id: z.number(),
          name: z.string()
        })
      )
      .parse(
        await (
          await fetch(`${state.url}/api/v1/courses`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ).json()
      );

    // Check given course exists
    const course = courses.find(x => x.id === state.courseId);
    if (course === undefined)
      throw new Error(`Could not find course with id ${state.courseId}`);
    core.info(`Found course with id ${state.courseId}`);

    // TODO: Check given assignment exists

    // Upload all files
    core.info(`Uploading file(s) ${file_pattern}`);
    const uploads = await Promise.all(
      glob.sync(file_pattern).map(async x => await uploadFile(state, x))
    );

    // Submit file(s) to assignment
    const submitURL = new URL(
      `${state.url}/api/v1/courses/${state.courseId}/assignments/${state.assignmentId}/submissions`
    );
    submitURL.searchParams.append(
      'submission[submission_type]',
      'online_upload'
    );
    for (const upload of uploads) {
      submitURL.searchParams.append(
        'submission[file_ids][]',
        upload.id.toString()
      );
    }

    const submitResponse = await fetch(submitURL.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      },
      method: 'POST'
    });
    if (!submitResponse.ok) throw new Error('Unable to submit file(s)');

    core.info(`Submitted file(s) to assignment`);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
