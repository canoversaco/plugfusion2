const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { notifyUser, notifyCourier } = require('../lib/notify'); // nutzt eure bestehende notify-Utils

// Kurier akzeptiert oder ändert Treffpunkt
router.post('/api/orders/:id/meeting', async (req, res) => {
  try{
    const id = Number(req.params.id);
    const { action, point } = req.body || {};
    const ord = (await db.one('select * from orders where id = ?', [id]).catch(()=>null)) 
             || (await db.one('select * from orders where id = $1', [id]).catch(()=>null));
    if(!ord) return res.status(404).json({error:'order_not_found'});

    let meeting_status = ord.meeting_status || null;
    let lat = ord.meeting_lat, lng = ord.meeting_lng, desc = ord.meeting_desc;

    if (action === 'accept'){
      meeting_status = 'accepted';
    } else if (action === 'change' && point){
      lat = Number(point.lat||0)||null;
      lng = Number(point.lng||0)||null;
      desc = point.desc||null;
      meeting_status = 'changed';
    } else {
      return res.status(400).json({error:'invalid_action'});
    }

    // Update
    const params = [lat, lng, desc, meeting_status, id];
    await (db.exec('update orders set meeting_lat=?, meeting_lng=?, meeting_desc=?, meeting_status=? where id=?', params)
          .catch(()=>db.exec('update orders set meeting_lat=$1, meeting_lng=$2, meeting_desc=$3, meeting_status=$4 where id=$5', params)));

    // Notify Kunde & Kurier
    try {
      await notifyUser(ord.user_id, {
        type: 'meeting_update',
        order_id: id,
        meeting: {lat,lng,desc,status:meeting_status}
      });
      if (ord.courier_id){
        await notifyCourier(ord.courier_id, {
          type: 'meeting_update',
          order_id: id,
          meeting: {lat,lng,desc,status:meeting_status}
        });
      }
    } catch(e){ /* non-fatal */ }

    res.json({ ok:true, meeting: {lat,lng,desc,status:meeting_status} });
  }catch(e){
    console.error(e);
    res.status(500).json({error:'server_error'});
  }
});

module.exports = router;
