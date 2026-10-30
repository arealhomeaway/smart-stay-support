import { describe, it, expect } from "vitest";
import { zipSync, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { prepareUploadSelection } from "../zip-upload";
const MB=1024*1024;
function rnd(n:number){const a=new Uint8Array(n);for(let i=0;i<n;i+=65536)crypto.getRandomValues(a.subarray(i,Math.min(n,i+65536)));return a;}
describe("probe",()=>{
  it("58MB zip one mp4 deflate",async()=>{
    const z=zipSync({"walk.mp4":[rnd(58*MB),{level:1}]});
    const r=await prepareUploadSelection([new File([z],"v.zip",{type:"application/x-zip-compressed"})],true);
    console.log("deflate",r.messages,r.files.map(f=>[f.name,f.type,f.size]));
  },120000);
  it("streamed zip with data descriptor",async()=>{
    const parts:Uint8Array[]=[];const zip=new Zip((e,d)=>{parts.push(d)});const f=new ZipDeflate("Clip.MOV",{level:1});zip.add(f);f.push(rnd(20*MB),true);zip.end();
    const r=await prepareUploadSelection([new File(parts,"v.zip",{type:"application/zip"})],true);
    console.log("descriptor",r.messages,r.files.map(f=>[f.name,f.type,f.size]));
  },120000);
  it("deflate64 method 9",async()=>{
    const z=zipSync({"walk.mp4":[rnd(1*MB),{level:0}]});const v=new DataView(z.buffer);
    // patch method in local + central headers
    for(let i=0;i<z.length-4;i++){const s=v.getUint32(i,true);if(s===0x04034b50)v.setUint16(i+8,9,true);if(s===0x02014b50)v.setUint16(i+10,9,true);}
    const r=await prepareUploadSelection([new File([z],"v.zip")],true);console.log("d64",r.messages);
  });
  it("m4v zip",async()=>{const z=zipSync({"walk.m4v":rnd(1000)});const r=await prepareUploadSelection([new File([z],"v.zip")],true);console.log("m4v",r.messages,r.files.length);});
});
