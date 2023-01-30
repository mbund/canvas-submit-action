[![typescript-action status](https://github.com/mbund/canvas-submit-action/workflows/build-test/badge.svg)](https://github.com/mbund/canvas-submit-action/actions)

# Submit assignments to Canvas LMS

This action allows you to automatically submit assignments to [Canvas](https://www.instructure.com/canvas).

## Input variables

```yaml
url:
  required: true
  description: 'Canvas LMS url i.e. https://your.instructure.com/courses/123456/assignments/7891234'
token:
  required: true
  description: 'Generated Canvas LMS access token'
file:
  required: true
  description: 'Local file(s) to upload, supports globbing'
```

## Usage

### Generating an access token

In your `Account > Settings`, under `Approved Integrations`, generate a new access token. **Set that value as as a GitHub secret**, i.e. `CANVAS_TOKEN`.

### Assignment url

In your Canvas dashboard, navigate to the assignment which the action will be submit to. Use that url as the url input to the action, optionally as a secret as well if you do not want to expose your institution (i.e. `CANVAS_URL`).

## Code example

```yaml
name: Submit
on:
  push:

jobs:
  build:
    name: Submit assignment
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Make
        run: make

      - name: Submit to Canvas
        uses: mbund/canvas-submit-action@v1
        with:
          url: ${{ secrets.CANVAS_URL }}
          token: ${{ secrets.CANVAS_TOKEN }}
          file: upload-test.pdf
```
