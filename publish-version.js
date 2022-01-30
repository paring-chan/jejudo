/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */
/* eslint-disable */

const pkg = require('./package.json')
const fs = require('fs')

pkg.version = pkg.version + '-dev.' + process.env.COMMIT_ID

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
