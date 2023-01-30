import * as core from '@actions/core'

import {z} from 'zod'
import fs from 'fs'
import fetch, {FormData, fileFromSync} from 'node-fetch'

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', {required: true})
    const courseId = z
      .number({invalid_type_error: 'Course ID must be a number', coerce: true})
      .nonnegative()
      .int()
      .parse(core.getInput('course', {required: true}))
    const assignmentId = z
      .number({
        invalid_type_error: 'Assignment ID must be a number',
        coerce: true
      })
      .nonnegative()
      .int()
      .parse(core.getInput('assignment', {required: true}))
    const url = z
      .string()
      .url()
      .parse(core.getInput('url', {required: true}))
    const filepath = core.getInput('file', {required: true})
    core.info(`uploading file ${filepath}`)

    const filestat = fs.statSync(filepath)
    if (!filestat.isFile()) throw new Error(`File ${filepath} is not a file`)
    const file = {
      size: filestat.size,
      bytes: fileFromSync(filepath)
    }

    core.info(`Uploading ${file.size} bytes to ${url}`)

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
          await fetch(`${url}/api/v1/courses`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ).json()
      )

    // Check given course exists
    const course = courses.find(x => x.id === courseId)
    if (course === undefined)
      throw new Error(`Could not find course with id ${courseId}`)
    core.info(`Found course with id ${courseId}`)

    // TODO: Ensure assignment exists
    const uploadBucketForm = new FormData()
    uploadBucketForm.append('name', filepath)
    uploadBucketForm.append('size', file.size.toString())
    const uploadBucket = z
      .object({
        upload_url: z.string().url(),
        upload_params: z.any()
      })
      .parse(
        await (
          await fetch(
            `${url}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              },
              method: 'POST',
              body: uploadBucketForm
            }
          )
        ).json()
      )
    core.info(`Recieved upload bucket`)

    const uploadForm = new FormData()
    for (const key in uploadBucket.upload_params)
      uploadForm.append(key, uploadBucket.upload_params[key])
    uploadForm.append('file', file.bytes)
    const location = z.string().parse(
      (
        await fetch(uploadBucket.upload_url, {
          method: 'POST',
          body: uploadForm
        })
      ).headers.get('Location')
    )

    core.info(`Recieved upload location`)

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
              Authorization: `Bearer ${token}`,
              'Content-Length': '0'
            },
            method: 'POST'
          })
        ).json()
      )

    core.info(
      `Uploaded file as ${uploadResponse.display_name} with size ${uploadResponse.size}`
    )

    // Submit file to assignment
    const submitURL = new URL(
      `${url}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`
    )
    submitURL.searchParams.append(
      'submission[submission_type]',
      'online_upload'
    )
    submitURL.searchParams.append(
      'submission[file_ids][]',
      uploadResponse.id.toString()
    )
    const submitResponse = await fetch(submitURL.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      },
      method: 'POST'
    })

    core.info(`Submitted file to assignment ${JSON.stringify(submitResponse)}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
