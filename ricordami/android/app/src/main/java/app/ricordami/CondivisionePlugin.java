package app.ricordami;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Testi condivisi da altre app (WhatsApp, Gmail, browser…) verso RicordaMi.
 * All'avvio la pagina chiede leggi(); se l'app è già aperta arriva l'evento "condiviso".
 */
@CapacitorPlugin(name = "Condivisione")
public class CondivisionePlugin extends Plugin {
    private String inAttesa = null;

    @Override
    public void load() {
        inAttesa = estrai(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String testo = estrai(intent);
        if (testo == null) return;
        JSObject dati = new JSObject();
        dati.put("testo", testo);
        if (hasListeners("condiviso")) notifyListeners("condiviso", dati);
        else inAttesa = testo;
    }

    @PluginMethod
    public void leggi(PluginCall call) {
        JSObject r = new JSObject();
        r.put("testo", inAttesa);
        inAttesa = null;
        call.resolve(r);
    }

    private static String estrai(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String oggetto = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        String testo = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (testo == null && oggetto == null) return null;
        intent.setAction(Intent.ACTION_MAIN); // non rileggerlo a ogni rotazione
        String tutto = ((oggetto != null ? oggetto + " " : "") + (testo != null ? testo : "")).trim();
        return tutto.length() > 300 ? tutto.substring(0, 300) : tutto;
    }
}
