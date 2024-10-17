// This asserts that the mocked API module has the same interface as the real API module

import * as api from '../api';
import * as apiMock from './api';

apiMock satisfies typeof api;
api satisfies typeof apiMock;
