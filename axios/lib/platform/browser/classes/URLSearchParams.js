'use strict';
// 导出原生的URLSearchParams或者自定义的AxiosURLSearchParams
import AxiosURLSearchParams from '../../../helpers/AxiosURLSearchParams.js';
export default typeof URLSearchParams !== 'undefined' ? URLSearchParams : AxiosURLSearchParams;
