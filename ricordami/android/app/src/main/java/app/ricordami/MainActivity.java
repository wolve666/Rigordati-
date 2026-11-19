package app.ricordami;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin dell'app: riceve i testi condivisi da altre app ("Condividi con RicordaMi").
        registerPlugin(CondivisionePlugin.class);
        // Aggiornamenti dell'app scaricati dalle release di GitHub.
        registerPlugin(AggiornamentoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
