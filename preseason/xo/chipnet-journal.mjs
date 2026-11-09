import {constants,openSync,closeSync,writeFileSync,fsyncSync,linkSync,unlinkSync,readFileSync,lstatSync} from 'node:fs';
import {dirname} from 'node:path';
export function syncDirectory(path) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  try{fsyncSync(fd);}finally{closeSync(fd);}
}
// All callers provide public-only bytes. link is atomic and refuses an existing name.
export function publishExclusive(path, bytes) {
  const tmp=path+'.pending';
  const fd=openSync(tmp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  linkSync(tmp,path);syncDirectory(dirname(path));unlinkSync(tmp);syncDirectory(dirname(path));
}
export function createJournal(path, first) {
  const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{writeFileSync(fd,JSON.stringify(first)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  syncDirectory(dirname(path));
}
export function appendJournal(path, record) {
  const fd=openSync(path,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);
  try{writeFileSync(fd,JSON.stringify(record)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
}
export function readJournal(path) {
  const meta=lstatSync(path);
  if(!meta.isFile()||meta.isSymbolicLink()||meta.size>65536)throw Error('INVALID_JOURNAL');
  const rows=readFileSync(path,'utf8').trimEnd().split('\n').map(line=>JSON.parse(line));
  return rows;
}
