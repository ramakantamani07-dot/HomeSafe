Pod::Spec.new do |s|
  s.name           = 'NearbyPlaces'
  s.version        = '1.0.0'
  s.summary        = 'Point-of-interest search via MapKit'
  s.description    = 'Wraps MKLocalSearch so wayLoc can find nearby places without a billed API key.'
  s.author         = ''
  s.homepage       = 'https://wayloc.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
