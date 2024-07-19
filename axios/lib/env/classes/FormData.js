import _FormData from 'form-data';
// 返回原生的FormData或form-data库对象
export default typeof FormData !== 'undefined' ? FormData : _FormData;
