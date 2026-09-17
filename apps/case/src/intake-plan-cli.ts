#!/usr/bin/env node

import { SRM_ONLY_MESSAGE } from "./registry/srm-boundary.js";

throw new Error(SRM_ONLY_MESSAGE);
