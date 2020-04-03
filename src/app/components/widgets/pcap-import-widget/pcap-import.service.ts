
import { Injectable } from '@angular/core';
//import {encapsulate} from 'hep-js/bundle';
import {encapsulate} from 'hep-js';
//import * as SIP from 'sipcore/dist/client';
import { Buffer } from 'buffer/client';

@Injectable({
    providedIn:'root'
})
export class PcapImportService {

url = ''


connection 
decoded = {
    ipv4 : {
        tcp:{
            data:0,
            srcport:0,
            dstport:0
        },
        udp:{
            data:0,
            srcport:0,
            dstport:0

        },
        src:0,
        dst:0,
    },
    ts_sec:'0'
}

heparray

hep_proto:any = { 
    "type": "HEP", 
    "version": 3, 
    "payload_type": "SIP", 
    "captureId": 9999, 
    "ip_family": 2, 
    "capturePass": "wss" 
};

    constructor(){

    }

  
    sendHep3(txt, rcinfo){
      console.log(JSON.stringify(encapsulate));
        this.connection =  new WebSocket('ws://my-server/api/v3/ws');
        this.connection.onopen =  () => {
  
            this.connection.binaryType = 'arraybuffer';
          }
        if(rcinfo ) {
            try {
                var hep_message = encapsulate(txt,rcinfo)
                console.log(hep_message)
                if(hep_message) {
                    let packet = Buffer.from(hep_message);
                    this.connection.send(packet);
            }
        }
        catch (err) {
            console.log('HEP3 Error sending to web socket!',err)
        }
     }
    }

 

    processPacket(msg){
        try { this.decoded = JSON.parse(msg) } catch { this.decoded = msg }
   
        if(this.decoded && this.decoded.ipv4 && this.decoded.ipv4.tcp) {
            let payload = String.fromCharCode(...Object.values(this.decoded.ipv4.tcp.data));
            this.hep_proto.ip_family = 2;
            this.hep_proto.protocol = 6;
            this.hep_proto.proto_type = 1;
            this.hep_proto.srcIp = this.decoded.ipv4.src;
            this.hep_proto.dstPort = this.decoded.ipv4.dst;
            this.hep_proto.srcPort = this.decoded.ipv4.tcp.srcport;
            this.hep_proto.dstPort = this.decoded.ipv4.tcp.dstport;
            this.hep_proto.time_sec = parseInt(this.decoded.ts_sec);
            this.hep_proto.time_usec = parseInt(this.decoded.ts_sec.toString().split('.')[1]) | 0o00 ;
            this.sendHep3(payload, this.hep_proto);
        }
      
        if(this.decoded && this.decoded.ipv4 && this.decoded.ipv4.udp){
            let payload = String.fromCharCode(...Object.values(this.decoded.ipv4.udp.data));
            this.hep_proto.ip_family = 2;
            this.hep_proto.protocol = 17;
            this.hep_proto.proto_type = 1;
            this.hep_proto.srcIp = this.decoded.ipv4.src;
            this.hep_proto.dstIp = this.decoded.ipv4.dst;
            this.hep_proto.srcPort = this.decoded.ipv4.udp.srcport;
            this.hep_proto.dstPort = this.decoded.ipv4.udp.dstport;
            this.hep_proto.time_sec = parseInt(this.decoded.ts_sec);
            this.hep_proto.time_usec = parseInt(this.decoded.ts_sec.toString().split('.')[1]) | 0o00;
            this.sendHep3(payload, this.hep_proto);
        }
    }
    processFrames(frames){
      
        frames.forEach(frame => this.processPacket(frame))
        
      }
}
